import {EventEmitter}   from '@barlus/bone/node/events';
import {Socket}         from '@barlus/bone/node/net';
import {ServerRequest}  from '@barlus/bone/node/http';
import {RequestOptions} from '@barlus/bone/node/http';
import {process}        from '@barlus/bone/node/process';


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
    let name = options.host || 'localhost';
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
  addRequest(req: ServerRequest, options: RequestOptions) {
    const name = this.getName(options);
    if (!this.sockets[ name ]) {
      this.sockets[ name ] = [];
    }

    const freeLen = this.freeSockets[ name ] ? this.freeSockets[ name ].length : 0;
    const sockLen = freeLen + this.sockets[ name ].length;

    if (freeLen) {
      // we have a free socket, so use that.
      const socket = this.freeSockets[ name ].shift();
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
      // internal request function
      (req as any).onSocket(socket);
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
  createSocket(req: ServerRequest, options, cb) {
    const name = this.getName(options);
    options._agentKey = name;
    options.encoding = null;
    let called = false;

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
  removeSocket(s: Socket, options) {
    const name = this.getName(options);
    //debug('removeSocket', name, 'writable:', s.writable);
    const sets = [ this.sockets ];

    // If the socket was destroyed, remove it from the free buffers too.
    if (!s.writable) {
      sets.push(this.freeSockets);
    }
    for (let sk = 0; sk < sets.length; sk++) {
      const sockets = sets[ sk ];

      if (sockets[ name ]) {
        const index = sockets[ name ].indexOf(s);
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
      const req = this.requests[ name ][ 0 ];
      // If we have pending requests and a socket gets closed make a new one
      this.createSocket(req, options, handleSocketCreation(req, false));
    }
  }
  keepSocketAlive(socket: Socket) {
    socket.setKeepAlive(true, this.keepAliveMsecs);
    socket.unref();
    return true;
  }
  reuseSocket(socket: Socket, req: ServerRequest) {
    socket.ref();
  }
  destroy() {
    const sets = [ this.freeSockets, this.sockets ];
    for (let s = 0; s < sets.length; s++) {
      const set = sets[ s ];
      const keys = Object.keys(set);
      for (let v = 0; v < keys.length; v++) {
        const setName = set[ keys[ v ] ];
        for (let n = 0; n < setName.length; n++) {
          setName[ n ].destroy();
        }
      }
    }
  }
  createConnection(options, cb) {
    return Socket.createConnection(options, cb);
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
function installListeners(agent: HttpAgent, s: Socket, options) {
  function onFree() {
    agent.emit('free', s, options);
  }
  s.on('free', onFree);

  function onClose(err) {
    // debug('CLIENT socket onClose');
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
    // debug('CLIENT socket onRemove');
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

