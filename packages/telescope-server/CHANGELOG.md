# @adonis-agora/telescope-server

## 0.1.0

### Minor Changes

- [#1](https://github.com/DavideCarvalho/adonis-agora-telescope-server/pull/1) [`a2928bd`](https://github.com/DavideCarvalho/adonis-agora-telescope-server/commit/a2928bdcf306c7d07ed338f5e9a4c0e799d2f6d8) Thanks [@DavideCarvalho](https://github.com/DavideCarvalho)! - First release. Several AdonisJS apps send their Telescope entries to one central server, and its console shows them per app. Apps use `remoteStore()` in `config/telescope.ts`: batched, non-blocking sends, a bounded buffer that drops the oldest entries (and counts them) when full, retry with backoff, and an optional local `tee`. The server is `topology: 'control-plane'` with `verifyTenant` (`authkitTenantVerifier` or `sharedSecretVerifier`). It exposes `POST /_telescope/v1/ingest`, where entries are validated, size-limited, stored with the time the app recorded them, deduplicated by entry id (stored as `<app>:<id>`), and tagged `app:<partition>` / `env:<environment>` from the token. Also included: `agora:doctor` checks and `telescope-server:status`.
