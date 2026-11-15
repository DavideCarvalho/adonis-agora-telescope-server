import type { TelescopeStore } from '@adonis-agora/telescope';
import {
  type ControlPlaneTelescopeServerConfig,
  resolveIngestLimits,
  serverPrefix,
  type TelescopeServerConfig,
  type TenantTelescopeServerConfig,
} from './define_config.js';
import { whoami } from './doctor/checks.js';

/** What `telescope-server:status` reports. */
export type TelescopeServerStatus =
  | { topology: 'standalone' }
  | {
      topology: 'tenant';
      server: string;
      partition: string;
      /** How the server sees this app's token. */
      accepted: boolean;
      as?: { partition: string; environment?: string };
      message: string;
    }
  | {
      topology: 'control-plane';
      ingest: string;
      running: boolean;
      /** The apps the server has entries for, most entries first. */
      apps: Array<{ app: string; entries: number }>;
    };

/** The apps a store has entries for (`app:<id>` tags), with their entry counts. */
export async function appsInStore(
  store: TelescopeStore,
): Promise<Array<{ app: string; entries: number }>> {
  if (typeof store.countTags === 'function') {
    return (await store.countTags({ limit: 200, prefix: 'app:' })).map((row) => ({
      app: row.key.slice('app:'.length),
      entries: row.count,
    }));
  }
  const counts = new Map<string, number>();
  for (const entry of await store.list({ size: 5000, omitContent: true })) {
    for (const tag of entry.tags) {
      if (tag.startsWith('app:')) counts.set(tag.slice(4), (counts.get(tag.slice(4)) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([app, entries]) => ({ app, entries }))
    .sort((a, b) => b.entries - a.entries);
}

/** Build the status report (the command prints it). */
export async function telescopeServerStatus(
  config: TelescopeServerConfig,
  store: TelescopeStore | null,
  doFetch: typeof fetch = globalThis.fetch,
): Promise<TelescopeServerStatus> {
  if (config.topology === 'tenant') {
    const tenant = (config as TenantTelescopeServerConfig).tenant;
    const result = await whoami(tenant, doFetch);
    return {
      topology: 'tenant',
      server: serverPrefix(tenant.url),
      partition: tenant.partition,
      accepted: result.status !== 'error',
      ...(result.partition !== undefined
        ? {
            as: {
              partition: result.partition,
              ...(result.environment !== undefined ? { environment: result.environment } : {}),
            },
          }
        : {}),
      message: result.message,
    };
  }
  if (config.topology === 'control-plane') {
    const limits = resolveIngestLimits((config as ControlPlaneTelescopeServerConfig).ingest);
    return {
      topology: 'control-plane',
      ingest: `POST ${limits.path}/ingest`,
      running: store !== null,
      apps: store !== null ? await appsInStore(store) : [],
    };
  }
  return { topology: 'standalone' };
}
