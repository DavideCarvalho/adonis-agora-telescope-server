import { ListLoader } from '@adonisjs/core/ace';
import AgoraDoctor from './agora_doctor.js';
import TelescopeServerDoctor from './doctor.js';
import TelescopeServerStatusCommand from './status.js';

/**
 * The commands of `@adonis-agora/telescope-server`, registered by `configure` with
 * `rcFile.addCommand('@adonis-agora/telescope-server/commands')`.
 */
const loader = new ListLoader([AgoraDoctor, TelescopeServerDoctor, TelescopeServerStatusCommand]);

export const getMetaData = loader.getMetaData.bind(loader);
export const getCommand = loader.getCommand.bind(loader);

export default loader;
