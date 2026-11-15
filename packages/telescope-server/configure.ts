import type Configure from '@adonisjs/core/commands/configure';
import { stubsRoot } from './stubs/main.js';

/**
 * `node ace add @adonis-agora/telescope-server`:
 *
 * 1. registers the provider and the commands in `adonisrc.ts`;
 * 2. publishes `config/telescope_server.ts` (an app sending to a server; switch `topology` for the
 *    server itself);
 * 3. adds the variables it reads to the env validations.
 */
export async function configure(command: Configure) {
  const codemods = await command.createCodemods();

  // biome-ignore lint/suspicious/noExplicitAny: `updateRcFile` types its callback loosely.
  await codemods.updateRcFile((rcFile: any) => {
    rcFile.addProvider('@adonis-agora/telescope-server/telescope_server_provider');
    rcFile.addCommand('@adonis-agora/telescope-server/commands');
  });

  await codemods.makeUsingStub(stubsRoot(), 'config/telescope_server.stub', {});

  await codemods.defineEnvValidations({
    leadingComment: 'Agora telescope server',
    variables: {
      TELESCOPE_SERVER_URL: 'Env.schema.string.optional()',
      TELESCOPE_SERVER_TOKEN: 'Env.schema.string.optional()',
    },
  });

  command.logger.info(
    "In config/telescope.ts, add `central: remoteStore()` (from @adonis-agora/telescope-server) to `stores` and set `store: 'central'`.",
  );
  command.logger.info(
    'On the server: exempt its routes from Shield CSRF with exceptRoutes: (ctx) => telescopeServerCsrfExceptions(ctx.request.url()).',
  );
}
