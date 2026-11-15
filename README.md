# adonis-telescope-server

> [!WARNING]
> **Deprecated.** The central server now lives inside `@adonis-agora/telescope`: set
> `topology: 'control-plane'` (with `verifyTenant`) on the server and `topology: 'tenant'` (with
> `tenant: { url, partition, token }`) in each app's `config/telescope.ts`. See
> [Central Server](https://davidecarvalho.github.io/agora/docs/telescope/concepts/central-server).
> Remove this package, move `config/telescope_server.ts` into `config/telescope.ts`, replace
> `remoteStore({ tee })` with `tenant.local`, `telescopeServerCsrfExceptions` with
> `telescopeCsrfExceptions` and `telescope-server:status` with `telescope:server:status`.

A central Telescope server for AdonisJS apps. Every app sends its
[Telescope](https://github.com/DavideCarvalho/adonis-agora-telescope) entries to one server, and
that server's console shows them per app, with an App picker. Part of the
[Agora](https://davidecarvalho.github.io/agora) ecosystem.

```
packages/telescope-server  @adonis-agora/telescope-server  the ingest route (server) and the remote store (apps)
```

```sh
node ace add @adonis-agora/telescope-server
```

See `docs/` for setup.

## Development

```sh
pnpm install
pnpm build && pnpm typecheck && pnpm test && pnpm lint
```
