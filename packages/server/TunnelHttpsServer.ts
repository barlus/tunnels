import {Tls}     from '@barlus/bone/node/tls'
import {Buffer}  from '@barlus/bone/node/buffer'
import {Fs}      from '@barlus/bone/node/fs'
import {process} from '@barlus/bone/node/process'


const options = {
  key: Fs.readFileSync('./certs/sites.li.key'),
  cert: Fs.readFileSync('./certs/sites.li.crt'),

  ALPNProtocols: [ 'http/1.1' ]
};

const { HTTPParser } = process.binding('http_parser');
console.info(process.binding('tls_wrap'));
console.info(process.binding('tcp_wrap'));


const server = Tls.createServer(options);
const tlsSessionStore = {};
server.on('newSession', (id, data, cb) => {
  let sid = id.toString('hex');
  console.info('newSession', sid);
  tlsSessionStore[ sid ] = data;
  cb(null, null);
});
server.on('resumeSession', (id, cb) => {
  let sid = id.toString('hex');
  console.info('resumeSession', sid);
  cb(null, tlsSessionStore[ sid ] || null);
});
let sockets = new Set();
server.on('secureConnection', (socket) => {
  console.log('server connected', socket.authorized ? 'authorized' : 'unauthorized');
  if (!socket.authorized) {
    console.error(socket.authorizationError)
  }
  if (!sockets.has(socket)) {
    sockets.add(socket);
    const parser = new HTTPParser(HTTPParser.REQUEST);
    parser[ HTTPParser.kOnHeaders ] = (headers, url) => {
      console.info("kOnHeaders", { headers, url });
    };
    parser[ HTTPParser.kOnHeadersComplete ] = (versionMajor, versionMinor, headers, method, url, statusCode, statusMessage, upgrade, shouldKeepAlive) => {
      console.info("kOnHeadersComplete", {
        versionMajor,
        versionMinor,
        headers,
        method,
        url,
        statusCode,
        statusMessage,
        upgrade,
        shouldKeepAlive
      });
    };
    parser[ HTTPParser.kOnBody ] = (b, start, len) => {
      console.info("kOnBody", { b, start, len });
    };
    parser[ HTTPParser.kOnMessageComplete ] = (...args) => {
      console.info("kOnMessageComplete", ...args);
      let body = Buffer.from('Hello There : I am secure text body');
      let head = Buffer.from(httpResHead(200, 'OK', [
        'Content-Type', 'text/plain; charset=utf-8',
        'Content-Length', `${body.byteLength}`
      ]));
      socket.write(head);
      socket.write(body);
      socket.end();
      socket.unref();
      parser.reinitialize(HTTPParser.REQUEST, true)
    };
    parser[ HTTPParser.kOnExecute ] = (...args) => {
      console.info("kOnExecute", ...args);
    };
    console.info(socket.readable, socket.writable);
    socket.on('data', (data) => {
      console.info(parser.execute(data))
    });
    socket.on('end', () => {
      console.info("END")
    });
    socket.on('error', (e) => {
      console.info("ERROR", e)
    });
    socket.on('close', () => {
      console.info("CLOSE")
    })
  }

  //socket.end();
});
server.listen(10443, () => {
  console.log('server bound');
});

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