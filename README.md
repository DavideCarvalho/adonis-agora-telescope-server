# adonis-telescope-server

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
