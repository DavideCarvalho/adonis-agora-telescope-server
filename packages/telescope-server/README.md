# @adonis-agora/telescope-server

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
