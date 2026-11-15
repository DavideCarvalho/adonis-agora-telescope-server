import { getTelescopeRuntime } from '@adonis-agora/telescope';
import type { ApplicationService } from '@adonisjs/core/types';
import {
  type ControlPlaneTelescopeServerConfig,
  resolveIngestLimits,
  serverPrefix,
  type TelescopeServerConfig,
  type TenantTelescopeServerConfig,
} from '../define_config.js';
import { activeRemoteStores } from '../tenant/remote_store.js';
import { readToken } from '../verify.js';
import { APP_HEADER } from '../wire.js';
import type { AgoraDoctorCheck, AgoraDoctorResult } from './agora_doctor.js';

const DOCS = 'https://github.com/DavideCarvalho/adonis-agora-telescope-server/tree/master/docs';

function configOf(app: ApplicationService): TelescopeServerConfig | null {
  // `--no-boot` never loads the config: every check must skip, not throw.
  try {
    return app.config?.get?.<TelescopeServerConfig>('telescope_server') ?? null;
  } catch {
    return null;
  }
}

const notBooted = (): AgoraDoctorResult => ({
  status: 'skip',
  message: 'The app is not booted: run without `--no-boot` to check the telescope server config.',
});

const skip = (message: string): AgoraDoctorResult => ({ status: 'skip', message });

/** Whether Shield's CSRF lets a POST to `url` through (no CSRF config = through). */
export function csrfExempts(csrf: unknown, url: string): boolean {
  if (csrf === null || typeof csrf !== 'object') return true;
  const config = csrf as { enabled?: unknown; exceptRoutes?: unknown };
  if (config.enabled === false) return true;
  const except = config.exceptRoutes;
  if (Array.isArray(except)) return except.some((route) => route === url);
  if (typeof except === 'function') {
    try {
      return (
        (except as (ctx: unknown) => unknown)({
          request: { url: () => url, method: () => 'POST' },
          route: { pattern: url },
        }) === true
      );
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * For Shield's `csrf.exceptRoutes`: whether `url` is a telescope server route (senders post
 * without a CSRF token).
 */
export function telescopeServerCsrfExceptions(url: string, path = '/_telescope/v1'): boolean {
  const prefix = resolveIngestLimits({ path }).path;
  return url === prefix || url.startsWith(`${prefix}/`);
}

/** The telescope server checks `agora:doctor` runs. */
export const agoraDoctorChecks: AgoraDoctorCheck[] = [
  {
    id: 'telescope-server.config',
    lib: 'telescope-server',
    title: 'Topology',
    run: (app) => {
      const config = configOf(app);
      if (config === null) return notBooted();
      const topology = config.topology ?? 'standalone';
      if (topology === 'standalone') {
        return skip('Standalone: this app keeps its own telescope entries.');
      }
      if (topology === 'tenant') {
        const tenant = (config as TenantTelescopeServerConfig).tenant;
        return {
          status: 'ok',
          message: `Sends entries as app ${JSON.stringify(tenant.partition)} to ${serverPrefix(tenant.url)}.`,
        };
      }
      const limits = resolveIngestLimits((config as ControlPlaneTelescopeServerConfig).ingest);
      return { status: 'ok', message: `Receives entries on POST ${limits.path}/ingest.` };
    },
  },
  {
    id: 'telescope-server.store',
    lib: 'telescope-server',
    title: 'Where entries go',
    run: (app) => {
      const config = configOf(app);
      if (config === null) return notBooted();
      if (config.topology === 'control-plane') {
        return getTelescopeRuntime().store !== null
          ? { status: 'ok', message: "Entries are written to this server's telescope store." }
          : {
              status: 'error',
              message:
                'Telescope is not running on this server: received entries cannot be stored.',
              fix: 'Register @adonis-agora/telescope/telescope_provider and enable it in config/telescope.ts.',
              docs: `${DOCS}/server.mdx`,
            };
      }
      if (config.topology === 'tenant') {
        return activeRemoteStores.size > 0
          ? { status: 'ok', message: 'config/telescope.ts sends entries with remoteStore().' }
          : {
              status: 'warn',
              message:
                "config/telescope.ts does not use remoteStore(): this app's entries stay local.",
              fix: "Add `central: remoteStore()` to `stores` in config/telescope.ts and set `store: 'central'`.",
              docs: `${DOCS}/apps.mdx`,
            };
      }
      return skip('Standalone: nothing to send.');
    },
  },
  {
    id: 'telescope-server.csrf',
    lib: 'telescope-server',
    title: 'Ingest route passes CSRF',
    run: (app) => {
      const config = configOf(app);
      if (config === null) return notBooted();
      if (config.topology !== 'control-plane') return skip('Not a control plane.');
      const limits = resolveIngestLimits((config as ControlPlaneTelescopeServerConfig).ingest);
      let csrf: unknown;
      try {
        csrf = app.config.get('shield.csrf');
      } catch {
        csrf = undefined;
      }
      return csrfExempts(csrf, `${limits.path}/ingest`)
        ? { status: 'ok', message: `POST ${limits.path}/ingest is not checked for a CSRF token.` }
        : {
            status: 'error',
            message: `Shield CSRF refuses POST ${limits.path}/ingest: every app's entries are rejected.`,
            fix: 'In config/shield.ts: csrf.exceptRoutes: (ctx) => telescopeServerCsrfExceptions(ctx.request.url()), from @adonis-agora/telescope-server.',
            docs: `${DOCS}/server.mdx`,
          };
    },
  },
  {
    id: 'telescope-server.reachable',
    lib: 'telescope-server',
    title: 'Server accepts this app',
    cost: 'deep',
    run: async (app): Promise<AgoraDoctorResult> => {
      const config = configOf(app);
      if (config === null) return notBooted();
      if (config.topology !== 'tenant') return skip('Not a tenant.');
      const tenant = (config as TenantTelescopeServerConfig).tenant;
      return whoami(tenant);
    },
  },
];

/** Ask the server who it takes this app for. */
export async function whoami(
  tenant: TenantTelescopeServerConfig['tenant'],
  doFetch: typeof fetch = globalThis.fetch,
): Promise<AgoraDoctorResult & { partition?: string; environment?: string }> {
  const prefix = serverPrefix(tenant.url);
  try {
    const token = await readToken(tenant.token);
    const response = await doFetch(`${prefix}/whoami`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        [APP_HEADER]: tenant.partition,
      },
      signal: AbortSignal.timeout(5000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      partition?: string;
      environment?: string;
    };
    if (response.status === 200 && typeof body.partition === 'string') {
      const env = body.environment !== undefined ? ` (${body.environment})` : '';
      return {
        status: body.partition === tenant.partition ? 'ok' : 'warn',
        message:
          body.partition === tenant.partition
            ? `The server accepts this app as ${JSON.stringify(body.partition)}${env}.`
            : `The server takes this app's token for ${JSON.stringify(body.partition)}${env}, not ${JSON.stringify(tenant.partition)}: entries are tagged with the token's app.`,
        partition: body.partition,
        ...(body.environment !== undefined ? { environment: body.environment } : {}),
      };
    }
    return {
      status: 'error',
      message: `The server refused this app's token (${response.status}).`,
      fix:
        response.status === 403
          ? 'Give the token the telescope:ingest capability.'
          : 'Check tenant.token and the server verifyTenant.',
      docs: `${DOCS}/apps.mdx`,
    };
  } catch (error) {
    return {
      status: 'error',
      message: `The server at ${prefix} cannot be reached: ${error instanceof Error ? error.message : String(error)}`,
      fix: 'Check tenant.url.',
      docs: `${DOCS}/apps.mdx`,
    };
  }
}
