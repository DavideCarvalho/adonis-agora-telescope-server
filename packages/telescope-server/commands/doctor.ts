import AgoraDoctor from './agora_doctor.js';

/**
 * `node ace telescope-server:doctor`: the shared `agora:doctor` runner, pre-filtered to this lib.
 * Same checks, same flags (`--deep`, `--json`, `--no-boot`), same exit codes.
 */
export default class TelescopeServerDoctor extends AgoraDoctor {
  static override commandName = 'telescope-server:doctor';
  static override description =
    'Check the telescope server configuration (agora:doctor --lib telescope-server)';
  protected override presetLib: string | undefined = 'telescope-server';
}
