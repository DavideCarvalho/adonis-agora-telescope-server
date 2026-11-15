---
'@adonis-agora/telescope-server': minor
---

First release. Several AdonisJS apps send their Telescope entries to one central server, and its console shows them per app. Apps use `remoteStore()` in `config/telescope.ts`: batched, non-blocking sends, a bounded buffer that drops the oldest entries (and counts them) when full, retry with backoff, and an optional local `tee`. The server is `topology: 'control-plane'` with `verifyTenant` (`authkitTenantVerifier` or `sharedSecretVerifier`). It exposes `POST /_telescope/v1/ingest`, where entries are validated, size-limited, deduplicated by entry id, and tagged `app:<partition>` / `env:<environment>` from the token. Also included: `agora:doctor` checks and `telescope-server:status`.
