import {WebSocket}       from '@barlus/bone/ws';
import {WebSocketServer} from '@barlus/bone/ws';
import {Https}           from '@barlus/bone/node/https';
import {Server}          from '@barlus/bone/node/https';
import {Socket}          from '@barlus/bone/node/net';
import {ServerRequest}   from '@barlus/bone/node/http';
import {ServerResponse}  from '@barlus/bone/node/http';
import {Buffer}          from '@barlus/bone/node/buffer';
import {Pattern}         from '@barlus/runtime/pattern';
import {injectable}      from '@barlus/runtime/inject/decorators';
import {singleton}       from '@barlus/runtime/inject/decorators';
import {TunnelSessions}  from './TunnelSessions';
import {Config}          from './web/Config';


@singleton
@injectable
export class TunnelServer {
  readonly config: Config;
  readonly proxy: Server;
  readonly routes: Pattern<any>[];
  readonly sessions: TunnelSessions;
  readonly wss: WebSocketServer;
  get subdomain(): Pattern<any> {
    let pattern = Pattern.regexp(`:subdomain.${this.config.domain}`, null);
    Object.defineProperty(this, 'subdomain', {
      value: pattern
    });
    return pattern;
  }
  private getSessionByHost(host: string) {
    let matched = String(host).match(this.subdomain);
    if (matched) {
      console.info(matched);
      return this.sessions.getSession(matched[ 1 ]);
    }
  }
  constructor(config: Config) {
    this.config = config;
    this.sessions = new TunnelSessions(this.config);
    this.wss = new WebSocketServer({
      noServer: true
    });
    this.routes = [
      Pattern.regexp(`/api/sessions/:subdomain`, {
        get: this.doRegister.bind(this)
      }),
      Pattern.regexp(`/api/sessions`, {
        get: this.getSessions.bind(this)
      })
    ]
  }
  async getSessions() {
    return this.sessions;
  }
  async doRegister(subdomain: string) {
    let session = this.sessions.getSession(subdomain);
    if (!session) {
      session = await this.sessions.createSession(subdomain, 'sergey');
    }
    return session;
  }
  async route(method: string, path: string, headers) {
    method = method.toLocaleLowerCase();
    for (const r of this.routes) {
      let matched = path.match(r);
      if (matched) {
        let [ full, ...params ] = matched;
        return await r.meta[ method ](...params);
      }
    }
  }
  async doUpgrade(req: ServerRequest, socket: Socket, head: Buffer) {
    if (req.headers.host === this.config.domain) {
      this.wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        ws.on('message', (message) => {
          console.info(message);
        })
      });
      // WS on main domain must reject connection
      // socket.destroy();
    } else {
      let session = this.getSessionByHost(req.headers.host);
      if (session) {
        session.proxyWs(req, socket, head);
      } else {
        socket.destroy();
      }
    }
  }
  async doRequest(req: ServerRequest, res: ServerResponse) {
    if (req.headers.host === this.config.domain) {
      const result = await this.route(req.method, req.url, req.headers);
      if (result) {
        writeJson(res, 200, result);
      } else {
        writeJson(res, 404, {
          status: 404,
          error: 'Not Found'
        });
      }
    } else {
      let session = this.getSessionByHost(req.headers.host);
      if (session) {
        session.proxyWeb(req, res);
      } else {
        res.writeHead(502);
        res.end('Bad Gateway')
      }
    }
  }
  async run() {
    const httpsServer = Https.createServer({
      cert: this.config.cert,
      key: this.config.key
    });
    httpsServer.on('request', this.doRequest.bind(this));
    httpsServer.on('upgrade', this.doUpgrade.bind(this));
    httpsServer.listen(this.config.port, this.config.address);

    console.info(`https://${this.config.domain}`);
  }
}

function writeJson(res: ServerResponse, status: number, data: any) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf8',
    'Content-Length': body.byteLength
  });
  res.end(body);
}