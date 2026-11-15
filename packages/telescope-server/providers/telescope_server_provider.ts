import { getTelescopeRuntime } from '@adonis-agora/telescope';
import type { HttpContext } from '@adonisjs/core/http';
import type { ApplicationService } from '@adonisjs/core/types';
import {
  type ControlPlaneTelescopeServerConfig,
  resolveIngestLimits,
  type TelescopeServerConfig,
} from '../src/define_config.js';
import { registerDoctorChecks } from '../src/doctor/agora_doctor.js';
import { agoraDoctorChecks } from '../src/doctor/checks.js';
import { createIngestHandler, type IngestResponse } from '../src/server/ingest.js';
import { activeRemoteStores } from '../src/tenant/remote_store.js';
import { APP_HEADER } from '../src/wire.js';

/** The bearer token of a request. */
function bearer(ctx: HttpContext): string | undefined {
  const header = ctx.request.header('authorization');
  if (typeof header !== 'string') return undefined;
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}

function send(ctx: HttpContext, response: IngestResponse) {
  ctx.response.header('cache-control', 'no-store');
  return ctx.response.status(response.status).json(response.body);
}

/**
 * `@adonis-agora/telescope-server`:
 * - on a control plane, registers `POST <path>/ingest` and `GET <path>/whoami`, writing every
 *   app's entries into this server's telescope store;
 * - on a tenant, nothing to register: `remoteStore()` in `config/telescope.ts` sends the entries,
 *   and this provider sends what is still buffered at shutdown.
 */
export default class TelescopeServerProvider {
  constructor(protected app: ApplicationService) {}

  async register() {
    await registerDoctorChecks(this.app.container, agoraDoctorChecks);
  }

  private config(): TelescopeServerConfig {
    return (
      this.app.config.get<TelescopeServerConfig | undefined>('telescope_server', undefined) ?? {}
    );
  }

  async boot() {
    const config = this.config();
    if (config.topology !== 'control-plane') return;
    const server = config as ControlPlaneTelescopeServerConfig;
    const limits = resolveIngestLimits(server.ingest);
    let logger: { warn(message: string): void } | null = null;
    try {
      logger = (await this.app.container.make('logger')) as { warn(message: string): void };
    } catch {
      // No logger: refusals are not logged.
    }
    const handler = createIngestHandler({
      verifyTenant: server.verifyTenant,
      store: () => getTelescopeRuntime().store,
      limits,
      onRefused: (reason, verified) =>
        logger?.warn(
          `[@adonis-agora/telescope-server] ingest refused (${reason})${verified ? ` for app ${JSON.stringify(verified.partition)}` : ''}`,
        ),
    });

    const router = await this.app.container.make('router');
    router
      .post(`${limits.path}/ingest`, async (ctx: HttpContext) => {
        const length = Number(ctx.request.header('content-length'));
        return send(
          ctx,
          await handler.ingest({
            token: bearer(ctx),
            app: ctx.request.header(APP_HEADER) ?? undefined,
            contentLength: Number.isFinite(length) ? length : undefined,
            body: ctx.request.body(),
          }),
        );
      })
      .as('telescope_server.ingest');
    router
      .get(`${limits.path}/whoami`, async (ctx: HttpContext) =>
        send(
          ctx,
          await handler.whoami({
            token: bearer(ctx),
            app: ctx.request.header(APP_HEADER) ?? undefined,
          }),
        ),
      )
      .as('telescope_server.whoami');
  }

  /** Send what the remote stores still hold before the process exits (best effort, bounded). */
  async shutdown() {
    const stores = [...activeRemoteStores];
    await Promise.race([
      Promise.allSettled(stores.map((store) => store.flush())),
      new Promise((resolve) => setTimeout(resolve, 5000).unref()),
    ]);
    for (const store of stores) store.stop();
  }
}
