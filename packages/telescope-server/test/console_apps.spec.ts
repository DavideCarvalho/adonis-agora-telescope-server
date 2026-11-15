import { InMemoryTelescopeStore } from '@adonis-agora/telescope';
import * as ui from '@adonis-agora/telescope/ui';
import { describe, expect, it } from 'vitest';
import { createIngestHandler } from '../src/server/ingest.js';
import { sharedSecretVerifier } from '../src/verify.js';

/** The console's App dimension (`@adonis-agora/telescope` with `apps` in `authorize`). */
const appsApi = ui as unknown as {
  describeAppScope?: (
    scope: { all: true } | { all: false; ids: string[] },
    store: unknown,
  ) => Promise<{ enabled: boolean; apps: Array<{ id: string }> }>;
  viewerStore?: (
    store: unknown,
    decision: { apps?: '*' | string[] },
    tenancy: { enabled: boolean; tag: string },
  ) => { list(): Promise<Array<{ tags: string[] }>> };
};

describe.skipIf(typeof appsApi.viewerStore !== 'function')(
  'what the server stores, as the console sees it per app',
  () => {
    it('two apps appear in the App picker; a viewer limited to one never reads the other', async () => {
      const store = new InMemoryTelescopeStore();
      const handler = createIngestHandler({
        verifyTenant: sharedSecretVerifier({ partitions: { shop: 's1', billing: 's2' } }),
        store: () => store,
      });
      const entry = (id: string) => ({ id, type: 'log', content: { id }, tags: [] });
      await handler.ingest({ token: 's1', app: 'shop', body: { entries: [entry('a')] } });
      await handler.ingest({ token: 's2', app: 'billing', body: { entries: [entry('b')] } });

      const picker = await appsApi.describeAppScope?.({ all: true }, store);
      expect(picker?.enabled).toBe(true);
      expect(picker?.apps.map((a) => a.id).sort()).toEqual(['billing', 'shop']);

      const shopOnly = appsApi.viewerStore?.(
        store,
        { apps: ['shop'] },
        { enabled: false, tag: 'tenant' },
      );
      const rows = (await shopOnly?.list()) ?? [];
      expect(rows.map((r) => r.tags)).toEqual([['app:shop']]);
    });
  },
);
