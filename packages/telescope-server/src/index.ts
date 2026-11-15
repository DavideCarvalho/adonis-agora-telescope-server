/** Keep in sync with this package's `version` in package.json. */
export const VERSION = '0.0.0';

export type {
  ControlPlaneTelescopeServerConfig,
  IngestLimits,
  ResolvedBufferOptions,
  ResolvedIngestLimits,
  StandaloneTelescopeServerConfig,
  TelescopeServerConfig,
  TenantBufferOptions,
  TenantTelescopeServerConfig,
} from './define_config.js';
export {
  DEFAULT_INGEST_PATH,
  defineConfig,
  resolveBufferOptions,
  resolveIngestLimits,
  serverPrefix,
} from './define_config.js';
export { csrfExempts, telescopeServerCsrfExceptions } from './doctor/checks.js';
export type {
  IngestHandler,
  IngestHandlerOptions,
  IngestRequest,
  IngestResponse,
} from './server/ingest.js';
export { createIngestHandler } from './server/ingest.js';
export type { TelescopeServerStatus } from './status.js';
export { appsInStore, telescopeServerStatus } from './status.js';
export type {
  RemoteStoreOptions,
  RemoteStoreStats,
  RemoteTelescopeStoreOptions,
} from './tenant/remote_store.js';
export { RemoteTelescopeStore, remoteStore } from './tenant/remote_store.js';
export type {
  SharedSecretTenant,
  TenantAuthRequest,
  TenantTokenSource,
  TenantVerifier,
  TenantVerifierInput,
  TenantVerifierModule,
  TenantVerifierObject,
  VerifiedTenant,
} from './verify.js';
export {
  canIngest,
  checkVerifiedTenant,
  INGEST_CAPABILITY,
  readToken,
  resolveTenantVerifier,
  sharedSecretVerifier,
  TELESCOPE_RESOURCE,
} from './verify.js';
export type { IngestBatch, IngestResult, WireEntry } from './wire.js';
export { APP_HEADER, WIRE_VERSION } from './wire.js';
