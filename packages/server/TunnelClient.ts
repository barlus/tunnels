import {Buffer}        from "@barlus/bone/node/buffer";
import {Https}         from "@barlus/bone/node/https";
import {process}       from "@barlus/bone/node/process";
import {URL}           from "@barlus/bone/node/url";
import {TunnelCluster} from "./TunnelCluster";
import {Signal}        from './utils/signal';
import {signal}        from './utils/signal';


async function delay(timeout: number) {
  return new Promise((accept) => setTimeout(timeout, accept));
}

async function get(url: URL) {
  return new Promise<{ status: number, headers: any, body: string }>((accept, reject) => {
    const req = Https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      res.on('end', (data) => {
        if (data) {
          chunks.push(data)
        }
        try {
          const body: string = Buffer.concat(chunks).toString('utf8');
          accept({
            status: res.statusCode,
            headers: res.headers,
            body
          })
        } catch (e) {
          reject(e)
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });

}

export class TunnelClient {
  private closed: boolean;
  public tunnel: URL;
  public public: URL;
  public id: string;
  public remoteHost: string;
  public remotePort: number;
  public localHost: string;
  public localPort: number;
  public maxConnections: number;
  private cluster: TunnelCluster;
  @signal readonly onClose: Signal<() => void>;
  constructor(url: string, localPort: string, localHost: string = '0.0.0.0') {
    this.tunnel = new URL(url);
    this.public = null;
    this.localHost = localHost;
    this.localPort = parseInt(localPort);
    this.remoteHost = this.tunnel.hostname;
    this.remotePort = 0;
    this.closed = false;
  }
  debug(message, ...args) {
    console.info(message, ...args);
  }
  async init(retryCount: number = 5) {
    let uri = this.tunnel;
    let tries = retryCount;
    while (tries-- > 0) {
      try {
        const response = await get(uri);
        const body = JSON.parse(response.body);
        if (!body.error) {
          this.id = body.id;
          this.public = new URL(body.url);
          this.remotePort = body.port;
          this.maxConnections = body.maxSockets;
          return true;
        } else {
          console.error(body.error);
          return false;
        }
      } catch (e) {
        console.error(e);
        await delay(1000);
      }
    }
  }
  async establish() {
    return new Promise((accept, reject) => {
      let tunnels = this.cluster = new TunnelCluster(this);
      // only emit the url the first time
      const onceOpen = tunnels.onOpen.attach(() => {
        tunnels.onOpen.detach(onceOpen);
        accept(this.public)
      });
      // re-emit socket error
      tunnels.onError.attach((err) => {
        console.error(err);
      });

      let tunnel_count = 0;
      // track open count
      tunnels.onOpen.attach((tunnel) => {
        tunnel_count++;
        process.stdout.write(`tunnel open [total: ${tunnel_count}]\r`);
        if (this.closed) {
          return tunnel.destroy();
        }
        let onceClose = this.onClose.attach(() => {
          tunnel.destroy();
          this.onClose.detach(onceClose)
        });
        tunnel.once('close', () => {
          this.onClose.detach(onceClose);
        });
      });
      // when a tunnel dies, open a new one
      tunnels.onDead.attach((reason: string) => {
        tunnel_count--;
        process.stdout.write(`tunnel dead [total: ${tunnel_count}]\r`);
        if (this.closed) {
          return;
        }
        tunnels.open();
      });
      // establish as many tunnels as allowed
      for (let count = 0; count < this.maxConnections; ++count) {
        tunnels.open();
      }
    });
  }
  async open() {
    if (await this.init()) {
      await this.establish();
    }
  }
  close() {
    this.closed = true;
    this.onClose();
  }
}