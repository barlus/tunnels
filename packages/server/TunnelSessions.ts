import {injectable}    from '@barlus/runtime/inject/decorators';
import {singleton}     from '@barlus/runtime/inject/decorators';
import {TunnelSession} from './TunnelSession';
import {Config}        from './web/Config';


@singleton
@injectable
export class TunnelSessions {

  readonly config: Config;
  readonly sessions = new Map<string, TunnelSession>();

  constructor(config: Config) {
    this.config = config;
  }
  debug(message: string, ...args) {
    console.debug(`TunnelSessions`, message, ...args)
  }
  async createSession(id: string, username: string): Promise<TunnelSession> {
    if (this.sessions.has(id)) {
      throw new Error('id already is use');
    }
    const client = new TunnelSession(id, this.config.domain, username);
    client.onClose.attach(() => {
      this.removeSession(id)
    });
    this.sessions.set(id, client);
    try {
      await client.listen();
      return client;
    } catch (err) {
      this.removeSession(id);
      throw err;
    }
  }
  removeSession(id: string): TunnelSession {
    const client = this.getSession(id);
    if (!client) {
      return;
    }
    this.sessions.delete(id);
    client.close();
  }
  getSession(id): TunnelSession {
    return this.sessions.get(id);
  }
  toJSON() {
    const sessions = [];
    this.sessions.forEach(c => {
      sessions.push(c.toJSON());
    });
    return sessions;
  }
}
