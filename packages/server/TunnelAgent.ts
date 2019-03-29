import {EventEmitter}   from '@barlus/bone/node/events';
import {Server, Socket} from '@barlus/bone/node/net';
import {process}        from '@barlus/bone/node/process';
import {signal, Signal} from './utils/signal';



export class HttpAgent extends EventEmitter {
  static defaultMaxSockets = 30;
  defaultPort: number;
  protocol: 'http:' | 'https:';
  options: {
    path: string;
    keepAlive: boolean;
    keepAliveMsecs: number;
    maxSockets: number;
    maxFreeSockets: number;
  };
  requests: {};
  sockets: {};
  freeSockets: {};
  keepAliveMsecs: number;
  keepAlive: boolean;
  maxSockets: number;
  maxFreeSockets: number;
  constructor(options) {
    super();
    this.defaultPort = 80;
    this.protocol = 'http:';

    this.options = Object.assign({}, options);

    // don't confuse net and make it think that we're connecting to a pipe
    this.options.path = null;
    this.requests = {};
    this.sockets = {};
    this.freeSockets = {};
    this.keepAliveMsecs = this.options.keepAliveMsecs || 1000;
    this.keepAlive = this.options.keepAlive || false;
    this.maxSockets = this.options.maxSockets || HttpAgent.defaultMaxSockets;
    this.maxFreeSockets = this.options.maxFreeSockets || 256;

    this.on('free', (socket, options) => {
      let name = this.getName(options);
      if (socket.writable &&
        this.requests[ name ] && this.requests[ name ].length) {
        this.requests[ name ].shift().onSocket(socket);
        if (this.requests[ name ].length === 0) {
          // don't leak
          delete this.requests[ name ];
        }
      } else {
        // If there are no pending requests, then put it in
        // the freeSockets pool, but only if we're allowed to do so.
        let req = socket._httpMessage;
        if (req &&
          req.shouldKeepAlive &&
          socket.writable &&
          this.keepAlive) {
          let freeSockets = this.freeSockets[ name ];
          let freeLen = freeSockets ? freeSockets.length : 0;
          let count = freeLen;
          if (this.sockets[ name ]) {
            count += this.sockets[ name ].length;
          }
          if (count > this.maxSockets || freeLen >= this.maxFreeSockets) {
            socket.destroy();
          } else if (this.keepSocketAlive(socket)) {
            freeSockets = freeSockets || [];
            this.freeSockets[ name ] = freeSockets;
            //socket[async_id_symbol] = -1;
            socket._httpMessage = null;
            this.removeSocket(socket, options);
            freeSockets.push(socket);
          } else {
            // Implementation doesn't want to keep socket alive
            socket.destroy();
          }
        } else {
          socket.destroy();
        }
      }
    });
  }
  getName(options) {
    var name = options.host || 'localhost';

    name += ':';
    if (options.port) {
      name += options.port;
    }

    name += ':';
    if (options.localAddress) {
      name += options.localAddress;
    }

    // Pacify parallel/test-http-agent-getname by only appending
    // the ':' when options.family is set.
    if (options.family === 4 || options.family === 6) {
      name += `:${options.family}`;
    }

    if (options.socketPath) {
      name += `:${options.socketPath}`;
    }

    return name;
  }
  addRequest(req, options, port/* legacy */, localAddress/* legacy */) {
    // Legacy API: addRequest(req, host, port, localAddress)
    if (typeof options === 'string') {
      options = {
        host: options,
        port,
        localAddress
      };
    }

    options = Object.assign({}, options);
    Object.assign(options, this.options);
    if (options.socketPath) {
      options.path = options.socketPath;
    }

    if (!options.servername) {
      options.servername = calculateServerName(options, req);
    }

    var name = this.getName(options);
    if (!this.sockets[ name ]) {
      this.sockets[ name ] = [];
    }

    var freeLen = this.freeSockets[ name ] ? this.freeSockets[ name ].length : 0;
    var sockLen = freeLen + this.sockets[ name ].length;

    if (freeLen) {
      // we have a free socket, so use that.
      var socket = this.freeSockets[ name ].shift();
      // Guard against an uninitialized or user supplied Socket.
      if (socket._handle && typeof socket._handle.asyncReset === 'function') {
        // Assign the handle a new asyncId and run any init() hooks.
        socket._handle.asyncReset();
        //socket[async_id_symbol] = socket._handle.getAsyncId();
      }

      // don't leak
      if (!this.freeSockets[ name ].length) {
        delete this.freeSockets[ name ];
      }

      this.reuseSocket(socket, req);
      req.onSocket(socket);
      this.sockets[ name ].push(socket);
    } else if (sockLen < this.maxSockets) {
      //debug('call onSocket', sockLen, freeLen);
      // If we are under maxSockets create a new one.
      this.createSocket(req, options, handleSocketCreation(req, true));
    } else {
      //debug('wait for socket');
      // We are over limit so we'll add it to the queue.
      if (!this.requests[ name ]) {
        this.requests[ name ] = [];
      }
      this.requests[ name ].push(req);
    }
  }
  createSocket(req, options, cb) {
    options = Object.assign({}, options);
    Object.assign(options, this.options);
    if (options.socketPath) {
      options.path = options.socketPath;
    }

    if (!options.servername) {
      options.servername = calculateServerName(options, req);
    }

    var name = this.getName(options);
    options._agentKey = name;

    //debug('createConnection', name, options);
    options.encoding = null;
    var called = false;

    const oncreate = (err, s) => {
      if (called) {
        return;
      }
      called = true;
      if (err) {
        return cb(err);
      }
      if (!this.sockets[ name ]) {
        this.sockets[ name ] = [];
      }
      this.sockets[ name ].push(s);
      //debug('sockets', name, this.sockets[name].length);
      installListeners(this, s, options);
      cb(null, s);
    };

    const newSocket = this.createConnection(options, oncreate);
    if (newSocket) {
      oncreate(null, newSocket);
    }
  }
  removeSocket(s, options) {
    var name = this.getName(options);
    //debug('removeSocket', name, 'writable:', s.writable);
    var sets = [ this.sockets ];

    // If the socket was destroyed, remove it from the free buffers too.
    if (!s.writable) {
      sets.push(this.freeSockets);
    }

    for (var sk = 0; sk < sets.length; sk++) {
      var sockets = sets[ sk ];

      if (sockets[ name ]) {
        var index = sockets[ name ].indexOf(s);
        if (index !== -1) {
          sockets[ name ].splice(index, 1);
          // Don't leak
          if (sockets[ name ].length === 0) {
            delete sockets[ name ];
          }
        }
      }
    }

    if (this.requests[ name ] && this.requests[ name ].length) {
      //debug('removeSocket, have a request, make a socket');
      var req = this.requests[ name ][ 0 ];
      // If we have pending requests and a socket gets closed make a new one
      this.createSocket(req, options, handleSocketCreation(req, false));
    }
  }
  keepSocketAlive(socket) {
    socket.setKeepAlive(true, this.keepAliveMsecs);
    socket.unref();

    return true;
  }
  reuseSocket(socket, req) {
    //debug('have free socket');
    socket.ref();
  }
  destroy() {
    var sets = [ this.freeSockets, this.sockets ];
    for (var s = 0; s < sets.length; s++) {
      var set = sets[ s ];
      var keys = Object.keys(set);
      for (var v = 0; v < keys.length; v++) {
        var setName = set[ keys[ v ] ];
        for (var n = 0; n < setName.length; n++) {
          setName[ n ].destroy();
        }
      }
    }
  }
  createConnection(options, cb){
    return Socket.createConnection(options,cb);
  }
}



export class TunnelAgent extends HttpAgent {
  static port = 30000;
  static getPort() {
    this.port++;
    if (this.port >= 30100) {
      this.port = 30000
    }
    return this.port;
  }
  readonly availableSockets: Socket[];
  waitingCreateConn: ((error: Error | null, result: any) => void)[];
  maxTcpSockets: number;
  connectedSockets: number;
  server: Server;
  started: boolean;
  closed: boolean;
  // on?(event,callback);
  // once?(event,callback);
  // emit?(event,...args);
  @signal readonly onEnd: Signal<() => void>;
  @signal readonly onOnline: Signal<() => void>;
  @signal readonly onOffline: Signal<() => void>;
  @signal readonly onError: Signal<() => void>;

  debug(message: string, ...other) {
    //console.debug('TunnelAgent', message, ...other);
  }
  error(message: string, ...other) {
    console.error(message, ...other);
  }
  constructor(options = {} as {
    clientId: string,
    maxSockets?: number
  }) {
    super({
      keepAlive: true,
      // only allow keepalive to hold on to one socket
      // this prevents it from holding on to all the sockets so they can be used for upgrades
      maxFreeSockets: 10,
    });
    // sockets we can hand out via createConnection
    this.availableSockets = [];
    this.connectedSockets = 0;
    // when a createConnection cannot return a socket, it goes into a queue
    // once a socket is available it is handed out to the next callback
    this.waitingCreateConn = [];
    // track maximum allowed sockets
    this.maxTcpSockets = options.maxSockets || HttpAgent.defaultMaxSockets;
    // new tcp server to service requests for this client
    this.server = new Server();
    // flag to avoid double starts
    this.started = false;
    this.closed = false;
    this[ 'on' ]('error', this.onError.bind(this));
  }

  listen() {
    const server = this.server;
    if (this.started) {
      throw new Error('already started');
    }
    this.started = true;
    server.on('close', this._onClose.bind(this));
    server.on('connection', this._onConnection.bind(this));
    server.on('error', (err) => {
      // These errors happen from killed connections, we don't worry about them
      if (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') {
        return;
      }
      this.error(err);
    });
    return new Promise<number>((resolve) => {
      server.listen(TunnelAgent.getPort(), '0.0.0.0', () => {
        const port = server.address().port;
        this.debug(`tcp server listening on port: ${port}`);
        resolve(port);
      });
    });
  }

  _onClose() {
    this.closed = true;
    this.debug('closed tcp socket');
    // flush any waiting connections
    for (const conn of this.waitingCreateConn) {
      conn(new Error('closed'), null);
    }
    this.waitingCreateConn = [];
    this.onEnd();
  }

  // new socket connection from client for tunneling requests to client
  _onConnection(socket: Socket) {
    // no more socket connections allowed
    if (this.connectedSockets >= this.maxTcpSockets) {
      this.debug('no more sockets allowed');
      socket.destroy();
      return false;
    }

    socket.once('close', (hadError) => {
      this.debug(`closed socket (error: ${hadError})`);
      this.connectedSockets -= 1;
      // remove the socket from available list
      const idx = this.availableSockets.indexOf(socket);
      if (idx >= 0) {
        this.availableSockets.splice(idx, 1);
      }
      this.debug(`connected sockets: ${this.connectedSockets}`);
      if (this.connectedSockets <= 0) {
        this.debug('all sockets disconnected');
        this.onOffline();
      }
    });

    // close will be emitted after this
    socket.once('error', (err) => {
      // we do not log these errors, sessions can drop from clients for many reasons
      // these are not actionable errors for our server
      socket.destroy();
    });

    if (this.connectedSockets === 0) {
      this.onOnline();
    }

    this.connectedSockets += 1;
    const { address, port } = socket.address();
    this.debug(`new connection from: ${address}:${port}`);

    // if there are queued callbacks, give this socket now and don't queue into available
    const fn = this.waitingCreateConn.shift();
    if (fn) {
      this.debug('giving socket to queued conn request');
      setTimeout(() => {
        fn(null, socket);
      }, 0);
      return;
    }

    // make socket available for those waiting on sockets
    this.availableSockets.push(socket);
  }

  // fetch a socket from the available socket pool for the agent
  // if no socket is available, queue
  // cb(err, socket)
  createConnection(options, cb) {
    if (this.closed) {
      cb(new Error('closed'));
      return;
    }

    this.debug('create connection');

    // socket is a tcp connection back to the user hosting the site
    const sock = this.availableSockets.shift();

    // no available sockets
    // wait until we have one
    if (!sock) {
      this.waitingCreateConn.push(cb);
      this.debug('waiting connected: %s', this.connectedSockets);
      this.debug('waiting available: %s', this.availableSockets.length);
      return;
    }

    this.debug('socket given');
    cb(null, sock);
    return sock;
  }

  destroy() {
    this.server.close();
    super.destroy();
  }
}



// 'use strict';
//
// const net = require('net');
// const util = require('util');
// const EventEmitter = require('events');
// const debug = util.debuglog('http');
// const { async_id_symbol } = require('internal/async_hooks').symbols;

//Agent.prototype.createConnection = net.createConnection;

function calculateServerName(options, req) {
  let servername = options.host;
  const hostHeader = req.getHeader('host');
  if (hostHeader) {
    // abc => abc
    // abc:123 => abc
    // [::1] => ::1
    // [::1]:123 => ::1
    if (hostHeader.startsWith('[')) {
      const index = hostHeader.indexOf(']');
      if (index === -1) {
        // Leading '[', but no ']'. Need to do something...
        servername = hostHeader;
      } else {
        servername = hostHeader.substr(1, index - 1);
      }
    } else {
      servername = hostHeader.split(':', 1)[ 0 ];
    }
  }
  return servername;
}
function installListeners(agent, s, options) {
  function onFree() {
    //debug('CLIENT socket onFree');
    agent.emit('free', s, options);
  }
  s.on('free', onFree);

  function onClose(err) {
    //debug('CLIENT socket onClose');
    // This is the only place where sockets get removed from the Agent.
    // If you want to remove a socket from the pool, just close it.
    // All socket errors end in a close event anyway.
    agent.removeSocket(s, options);
  }
  s.on('close', onClose);

  function onRemove() {
    // We need this function for cases like HTTP 'upgrade'
    // (defined by WebSockets) where we need to remove a socket from the
    // pool because it'll be locked up indefinitely
    //debug('CLIENT socket onRemove');
    agent.removeSocket(s, options);
    s.removeListener('close', onClose);
    s.removeListener('free', onFree);
    s.removeListener('agentRemove', onRemove);
  }
  s.on('agentRemove', onRemove);
}
function handleSocketCreation(request, informRequest) {
  return function handleSocketCreation_Inner(err, socket) {
    if (err) {
      process.nextTick(emitErrorNT, request, err);
      return;
    }
    if (informRequest) {
      request.onSocket(socket);
    } else {
      socket.emit('free');
    }
  };
}
function emitErrorNT(emitter, err) {
  emitter.emit('error', err);
}

