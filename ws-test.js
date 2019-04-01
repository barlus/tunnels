const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({server});
server.on('request', (req, res) => {
  res.end('{"hello":"there"}')
});
wss.on('connection', function connection(ws, req) {
  const id = Buffer.from(req.headers['sec-websocket-key'], 'base64').toString('hex');
  console.log(id, 'CONNECTED');
  ws.on('close', () => {
    console.log(id, 'CLOSED');
  });
  ws.on('message', (message) => {
    console.log(id, 'message', message);
    ws.send(message);
  });
});

server.listen(8080);