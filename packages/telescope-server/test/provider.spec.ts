import {
  InMemoryTelescopeStore,
  resetTelescopeRuntime,
  setTelescopeRuntime,
} from '@adonis-agora/telescope';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMetaData } from '../commands/main.js';
import TelescopeServerProvider from '../providers/telescope_server_provider.js';
import { defineConfig } from '../src/define_config.js';
import {
  agoraDoctorChecks,
  csrfExempts,
  telescopeServerCsrfExceptions,
} from '../src/doctor/checks.js';
import { appsInStore, telescopeServerStatus } from '../src/status.js';
import { activeRemoteStores, RemoteTelescopeStore } from '../src/tenant/remote_store.js';
import { sharedSecretVerifier } from '../src/verify.js';

type Handler = (ctx: unknown) => unknown;

function fakeApp(config: Record<string, unknown>) {
  const routes: Array<{ method: string; pattern: string; handler: Handler }> = [];
  const values = new Map<string, unknown>();
  const add = (method: string) => (pattern: string, handler: Handler) => {
    routes.push({ method, pattern, handler });
    return { as: () => undefined };
  };
  const app = {
    inProduction: false,
    config: { get: (key: string, fallback?: unknown) => (key in config ? config[key] : fallback) },
    container: {
      hasBinding: (key: string) => values.has(key),
      bindValue: (key: string, value: unknown) => values.set(key, value),
      make: async (key: string) => {
        if (key === 'router') return { post: add('POST'), get: add('GET') };
        if (key === 'logger') return { warn: () => {} };
        return values.get(key);
      },
    },
  };
  return { app: app as never, routes, values };
}

function ctx(headers: Record<string, string>, body: unknown) {
  const sent: { status?: number; body?: unknown } = {};
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    sent,
    ctx: {
      request: { header: (name: string) => lower[name.toLowerCase()], body: () => body },
      response: {
        header: () => undefined,
        status(code: number) {
          sent.status = code;
          return this;
        },
        json(value: unknown) {
          sent.body = value;
          return value;
        },
      },
    },
  };
}

afterEach(() => {
  resetTelescopeRuntime();
  for (const store of [...activeRemoteStores]) store.stop();
});

const serverConfig = defineConfig({
  topology: 'control-plane',
  verifyTenant: sharedSecretVerifier({ partitions: { shop: 'shop-secret' } }),
});

describe('provider', () => {
  it('a control plane registers the ingest routes and writes into the telescope store', async () => {
    const store = new InMemoryTelescopeStore();
    setTelescopeRuntime(store, false);
    const { app, routes } = fakeApp({ telescope_server: serverConfig });
    const provider = new TelescopeServerProvider(app);
    await provider.register();
    await provider.boot();
    expect(routes.map((r) => `${r.method} ${r.pattern}`)).toEqual([
      'POST /_telescope/v1/ingest',
      'GET /_telescope/v1/whoami',
    ]);
    const ingest = routes[0]?.handler as Handler;
    const ok = ctx(
      { authorization: 'Bearer shop-secret', 'x-telescope-app': 'shop', 'content-length': '200' },
      { version: 1, entries: [{ id: '1', type: 'log', content: {}, tags: ['app:other'] }] },
    );
    await ingest(ok.ctx);
    expect(ok.sent).toEqual({ status: 202, body: { accepted: 1, duplicates: 0, rejected: 0 } });
    expect((await store.list())[0]?.tags).toEqual(['app:shop']);

    const refused = ctx(
      { authorization: 'Bearer wrong', 'x-telescope-app': 'shop' },
      { entries: [] },
    );
    await ingest(refused.ctx);
    expect(refused.sent.status).toBe(401);
    const tooBig = ctx({ 'content-length': String(10 * 1024 * 1024) }, {});
    await ingest(tooBig.ctx);
    expect(tooBig.sent.status).toBe(413);
  });

  it('a tenant or a standalone app registers no route; shutdown sends what is buffered', async () => {
    for (const config of [
      {},
      { topology: 'tenant', tenant: { url: 'http://x', partition: 'a', token: 't' } },
    ]) {
      const { app, routes } = fakeApp({ telescope_server: config });
      await new TelescopeServerProvider(app).boot();
      expect(routes).toEqual([]);
    }
    const fetch = vi.fn(async () => new Response('{}', { status: 202 }));
    const store = new RemoteTelescopeStore({
      url: 'http://central',
      partition: 'a',
      token: 't',
      fetch: fetch as never,
      buffer: { flushIntervalMs: 60_000 },
    }).start();
    await store.record({ type: 'log', content: {} });
    await new TelescopeServerProvider(fakeApp({}).app).shutdown();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(activeRemoteStores.size).toBe(0);
  });

  it('ships agora:doctor, telescope-server:doctor and telescope-server:status', async () => {
    const names = (await getMetaData()).map((c) => c.commandName);
    expect(names).toEqual(['agora:doctor', 'telescope-server:doctor', 'telescope-server:status']);
  });
});

describe('doctor', () => {
  const run = async (id: string, config: Record<string, unknown>) => {
    const check = agoraDoctorChecks.find((c) => c.id === id);
    if (!check) throw new Error(id);
    return check.run(fakeApp(config).app);
  };

  it('registers its checks in the shared registry', async () => {
    const { app, values } = fakeApp({});
    await new TelescopeServerProvider(app).register();
    const registry = values.get('agora.doctor') as { checks: Array<{ id: string }> };
    expect(registry.checks.map((c) => c.id)).toEqual([
      'telescope-server.config',
      'telescope-server.store',
      'telescope-server.csrf',
      'telescope-server.reachable',
    ]);
  });

  it('server: telescope must run, the ingest route must pass CSRF', async () => {
    expect(await run('telescope-server.store', { telescope_server: serverConfig })).toMatchObject({
      status: 'error',
    });
    setTelescopeRuntime(new InMemoryTelescopeStore(), false);
    expect(await run('telescope-server.store', { telescope_server: serverConfig })).toMatchObject({
      status: 'ok',
    });
    expect(
      await run('telescope-server.csrf', {
        telescope_server: serverConfig,
        'shield.csrf': { enabled: true, exceptRoutes: [] },
      }),
    ).toMatchObject({ status: 'error' });
    expect(
      await run('telescope-server.csrf', {
        telescope_server: serverConfig,
        'shield.csrf': {
          enabled: true,
          exceptRoutes: (c: { request: { url(): string } }) =>
            telescopeServerCsrfExceptions(c.request.url()),
        },
      }),
    ).toMatchObject({ status: 'ok' });
    expect(csrfExempts(undefined, '/x')).toBe(true);
    expect(
      csrfExempts(
        { enabled: true, exceptRoutes: ['/_telescope/v1/ingest'] },
        '/_telescope/v1/ingest',
      ),
    ).toBe(true);
  });

  it('tenant: warns when config/telescope.ts does not use remoteStore(); skips when not booted', async () => {
    const tenant = { topology: 'tenant', tenant: { url: 'http://x', partition: 'a', token: 't' } };
    expect(await run('telescope-server.store', { telescope_server: tenant })).toMatchObject({
      status: 'warn',
    });
    expect(await run('telescope-server.config', { telescope_server: tenant })).toMatchObject({
      status: 'ok',
      message: 'Sends entries as app "a" to http://x/_telescope/v1.',
    });
    expect(await run('telescope-server.config', {})).toMatchObject({ status: 'skip' });
    expect(await run('telescope-server.reachable', {})).toMatchObject({ status: 'skip' });
  });

  it('tenant (deep): an unreachable server is an error', async () => {
    const result = await run('telescope-server.reachable', {
      telescope_server: {
        topology: 'tenant',
        tenant: { url: 'http://127.0.0.1:9', partition: 'a', token: 't' },
      },
    });
    expect(result).toMatchObject({ status: 'error' });
  });
});

describe('status', () => {
  it('server: the apps it has entries for; tenant: how the server sees it', async () => {
    const store = new InMemoryTelescopeStore();
    for (const tags of [['app:shop'], ['app:shop'], ['app:billing'], []]) {
      await store.record({ type: 'log', content: {}, tags });
    }
    expect(await appsInStore(store)).toEqual([
      { app: 'shop', entries: 2 },
      { app: 'billing', entries: 1 },
    ]);
    expect(await telescopeServerStatus(serverConfig, store)).toEqual({
      topology: 'control-plane',
      ingest: 'POST /_telescope/v1/ingest',
      running: true,
      apps: [
        { app: 'shop', entries: 2 },
        { app: 'billing', entries: 1 },
      ],
    });
    const fetch = vi.fn(async () => Response.json({ partition: 'shop', environment: 'prod' }));
    expect(
      await telescopeServerStatus(
        { topology: 'tenant', tenant: { url: 'http://central', partition: 'shop', token: 't' } },
        null,
        fetch as never,
      ),
    ).toMatchObject({
      topology: 'tenant',
      accepted: true,
      as: { partition: 'shop', environment: 'prod' },
    });
    expect(await telescopeServerStatus({}, null)).toEqual({ topology: 'standalone' });
  });
});
