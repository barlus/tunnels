import {Context}        from '@barlus/bone/http/context';
import {Buffer}         from '@barlus/bone/node/buffer';
import {Http}           from '@barlus/bone/node/http';
import {Agent}          from '@barlus/bone/node/http';
import {Server}         from '@barlus/bone/node/net';
import {Socket}         from '@barlus/bone/node/net';
import {HttpAgent}      from './TunnelAgent';
import {signal}         from './utils/signal';
import {Signal}         from './utils/signal';
import {LogRequest}     from "./web/log/LogRequest";
import {LogResponse}    from "./web/log/LogResponse";
import {LogContext}     from "./web/log/LogContext";
import {History}        from "./web/log/History";
import {ServerRequest}  from '@barlus/bone/node/http';
import {ServerResponse} from '@barlus/bone/node/http';
import {ClientRequest}  from '@barlus/bone/node/http';
import {ClientResponse} from '@barlus/bone/node/http';
// A client encapsulates req/res handling using an agent
//
// If an agent is destroyed, the request handling will error
// The caller is responsible for handling a failed request
declare module '@barlus/bone/node/http' {
  export interface ServerRequest {
    onSocket(socket: Socket)
  }
}
type SocketCallback = (err: Error, socket: Socket) => void;
export class TunnelSession extends Agent {
  static port = 30000;
  static getPort() {
    this.port++;
    if (this.port >= 30100) {
      this.port = 30000
    }
    return this.port;
  }

  id: string;
  domain: string;
  url: string;
  port: number;
  user: string;
  closing: boolean;
  server: Server;
  started: boolean;
  closed: boolean;
  name: string;
  readonly pending: SocketCallback[];
  readonly connectedSockets: Set<Socket>;
  readonly availableSockets: Set<Socket>;
  @signal onClose: Signal<() => void>;
  get socketsCount() {
    return this.connectedSockets.size + this.availableSockets.size
  }
  constructor(id: string, domain: string, user: string) {
    super();
    this.id = id;
    this.domain = domain;
    this.user = user;
    this.url = `https://${id}.${domain}`;
    this.name = `${id}.${domain}`;
    this.pending = [];
    this.availableSockets = new Set<Socket>();
    this.connectedSockets = new Set<Socket>();
    this.server = new Server();
  }
  close() {
    if (!this.closing) {
      this.closing = true;
      this.destroy();
      this.onClose();
    }
  }
  proxyWs(req: ServerRequest, socket: Socket, head: Buffer) {
    socket.pause();
    let proxyRequest = Http.request({
      method: req.method,
      path: req.url,
      headers: req.headers,
      agent: this
    });
    proxyRequest.on('upgrade', (proxyResponse: ClientResponse, proxySocket: Socket, head: Buffer) => {
      socket.on('data', (data) => {
        if (!proxySocket.destroyed) {
          proxySocket.write(data)
        }
      });
      // socket.once('end', (data) => {
      //   if (proxySocket.destroyed) {
      //     proxySocket.end(data);
      //   }
      // });
      socket.once('close', () => {
        if (!proxySocket.destroyed) {
          proxySocket.destroy();
        }
      });
      socket.resume();
      socket.write(httpResHead(
        proxyResponse.statusCode,
        proxyResponse.statusMessage,
        proxyResponse.rawHeaders
      ));
      proxySocket.on('data', (data) => {
        if (!socket.destroyed) {
          socket.write(data)
        }
      });
      // proxySocket.once('end', (data) => {
      //   if (!socket.destroyed) {
      //     socket.end(data);
      //   }
      // });
      proxySocket.once('close', () => {
        if (!socket.destroyed) {
          socket.destroy();
        }
      });
    });
    proxyRequest.end()

  }
  proxyWeb(req: ServerRequest, res: ServerResponse) {
    req.pause();
    let proxyRequest = Http.request({
      method: req.method,
      path: req.url,
      headers: req.headers,
      agent: this
    });
    proxyRequest.on('response', (proxyResponse: ClientResponse) => {
      res.writeHead(
        proxyResponse.statusCode,
        proxyResponse.statusMessage,
        proxyResponse.headers
      );
      proxyResponse.on('data', (data) => {
        res.write(data)
      });
      proxyResponse.on('end', (data) => {
        res.end(data)
      });
    });
    req.on('data', (data) => {
      proxyRequest.write(data)
    });
    req.on('end', (data) => {
      proxyRequest.end(data)
    });
    req.resume();
  }
  listen() {
    const server = this.server;
    if (this.started) {
      throw new Error('already started');
    }
    this.started = true;
    server.on('close', this.onClose.bind(this));
    server.on('connection', this.onConnection.bind(this));
    server.on('error', (err) => {
      // These errors happen from killed connections, we don't worry about them
      if (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') {
        return;
      }
    });
    return new Promise<this>((resolve) => {
      server.listen(TunnelSession.getPort(), '0.0.0.0', () => {
        this.port = server.address().port;
        resolve(this);
      });
    });
  }
  onConnection(socket: Socket) {
    socket.once('close', (hadError) => {
      this.connectedSockets.delete(socket);
      this.availableSockets.delete(socket);
    });
    // close will be emitted after this
    socket.once('error', () => {
      socket.destroy();
    });
    // make socket available for those waiting on sockets
    this.availableSockets.add(socket);
    if (this.pending.length) {
      this.getSocket(this.pending.shift());
    }
  }
  getName() {
    return this.name;
  }
  getSocket(cb: SocketCallback) {
    if (this.availableSockets.size) {
      let next = this.availableSockets.values().next();
      let socket = next.value;
      this.availableSockets.delete(socket);
      this.connectedSockets.add(socket);
      socket.once('free', () => {
        this.connectedSockets.delete(socket);
        this.availableSockets.add(socket);
      });
      cb(null, socket)
    } else {
      this.pending.push(cb)
    }
  }
  createConnection(options, cb) {
    this.getSocket(cb);
  }
  destroy(): void {
    super.destroy();
  }
  toJSON() {
    const socks = [];
    for (const sock of this.availableSockets) {
      socks.push({
        remoteAddress: sock.remoteAddress,
        remotePort: sock.remotePort,
        localAddress: sock.localAddress,
        localPort: sock.localPort,
        available: true,
      })
    }
    for (const sock of this.connectedSockets) {
      socks.push({
        remoteAddress: sock.remoteAddress,
        remotePort: sock.remotePort,
        localAddress: sock.localAddress,
        localPort: sock.localPort,
        available: false,
      })
    }
    return {
      id: this.id,
      url: this.url,
      port: this.port,
      domain: this.domain,
      maxSockets: 10,
      socketsCount: this.socketsCount,
      user: this.user,
      socks: socks
    }
  }
}

function httpReqHead(method: string, url: string, rawHeaders: string[]) {
  const arr = [ `${method} ${url} HTTP/1.1` ];
  for (let i = 0; i < (rawHeaders.length - 1); i += 2) {
    arr.push(`${rawHeaders[ i ]}: ${rawHeaders[ i + 1 ]}`);
  }
  arr.push('');
  arr.push('');
  return arr.join('\r\n')
}
function httpResHead(status: number, message: string, rawHeaders: string[]) {
  const arr = [ `HTTP/1.1 ${status} ${message}` ];
  for (let i = 0; i < (rawHeaders.length - 1); i += 2) {
    arr.push(`${rawHeaders[ i ]}: ${rawHeaders[ i + 1 ]}`);
  }
  arr.push('');
  arr.push('');
  return arr.join('\r\n')
}