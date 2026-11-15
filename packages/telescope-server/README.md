# @adonis-agora/telescope-server

> [!WARNING]
> **Deprecated.** The central server now lives inside `@adonis-agora/telescope`: set
> `topology: 'control-plane'` (with `verifyTenant`) on the server and `topology: 'tenant'` (with
> `tenant: { url, partition, token }`) in each app's `config/telescope.ts`. See
> [Central Server](https://davidecarvalho.github.io/agora/docs/telescope/concepts/central-server).
> Remove this package, move `config/telescope_server.ts` into `config/telescope.ts`, replace
> `remoteStore({ tee })` with `tenant.local`, `telescopeServerCsrfExceptions` with
> `telescopeCsrfExceptions` and `telescope-server:status` with `telescope:server:status`.

One Telescope for many AdonisJS apps: each app sends its
[Telescope](https://github.com/DavideCarvalho/adonis-agora-telescope) entries to one server, which
stores them tagged with the app's name, and the server's console shows them per app.

```sh
node ace add @adonis-agora/telescope-server
```

```ts
// config/telescope.ts, in each app
import { remoteStore } from '@adonis-agora/telescope-server'

export default defineConfig({
  store: 'central',
  stores: { central: remoteStore() },
})
```

Docs: https://github.com/DavideCarvalho/adonis-agora-telescope-server/tree/master/docs
