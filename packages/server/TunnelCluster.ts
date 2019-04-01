import {Socket}       from "@barlus/bone/node/net";
import {TunnelClient} from './TunnelClient';
import {Signal}       from './utils/signal';
import {signal}       from './utils/signal';


class Defer<T> {
  readonly promise: Promise<T>;
  readonly accept: () => void;
  readonly reject: () => void;
  constructor() {
    Object.defineProperty(this, 'promise', {
      value: new Promise<T>((accept, reject) => {
        Object.defineProperties(this, {
          accept: { value: accept },
          reject: { value: reject },
        });
      })
    });
  }
}
export class TunnelCluster {
  private worker: TunnelClient;
  @signal readonly onOpen: Signal<(remote: Socket) => void>;
  @signal readonly onDead: Signal<(reason: string) => void>;
  @signal readonly onError: Signal<(error: Error) => void>;
  connectionsCount = 0;
  connectionsLimit = 5;
  constructor(worker: TunnelClient) {
    this.worker = worker;
  }
  debug(message, ...args) {
    console.info(message, ...args);
  }

  async openRemoteSocket() {
    return new Promise<Socket>((accept, reject) => {
      const { remoteHost, remotePort } = this.worker;
      const remote = Socket.connect({
        host: remoteHost,
        port: remotePort
      });
      remote.setKeepAlive(true, 2000);
      remote.once('error', (err) => {
        // emit connection refused errors immediately, because they
        // indicate that the tunnel can't be established.
        remote.end();
        if (err.code === 'ECONNREFUSED') {
          reject(new Error(`connection refused: ${remoteHost}:${remotePort} (check your firewall settings)`));
        }
      });
      // tunnel is considered open when remote connects
      remote.once('connect', () => {
        remote.pause();
        accept(remote);
      });
    });
  }
  async openLocalSocket() {
    return new Promise<Socket>((accept, reject) => {
      const { localHost, localPort } = this.worker;
      const local = Socket.connect({
        host: localHost,
        port: localPort
      });
      local.setKeepAlive(true, 2000);
      local.once('error', (err) => {
        // emit connection refused errors immediately, because they
        // indicate that the tunnel can't be established.
        local.end();
        if (err.code === 'ECONNREFUSED') {
          reject(new Error(`connection refused: ${localHost}:${localPort} (check your firewall settings)`));
        }
      });
      // tunnel is considered open when remote connects
      local.once('connect', () => {
        local.pause();
        accept(local);
      });
    });
  }

  async open(onReady: Defer<void>) {
    const remoteDone = new Defer();
    const localDone = new Defer();

    let remote = await this.openRemoteSocket();
    this.debug(`remote connected to ${remote.remoteAddress}:${remote.remotePort}`);
    const remoteClose = () => {
      remote.removeListener('error', remoteError);
      remote.removeListener('close', remoteClose);
      this.debug(`remote closed from ${remote.remoteAddress}:${remote.remotePort}`);
      remoteDone.accept();
    };
    const remoteError = (err) => {
      remote.removeListener('error', remoteError);
      remote.removeListener('close', remoteClose);
      local.end();
      this.debug(`remote died from ${remote.remoteAddress}:${remote.remotePort}`);
      console.error(err);
      remoteDone.reject();
    };

    remote.once('error', remoteError);
    remote.once('close', remoteClose);

    let local = await this.openLocalSocket();
    this.debug(`local connected to ${local.remoteAddress}:${local.remotePort}`);
    const localClose = () => {
      local.removeListener('error', localError);
      local.removeListener('close', localClose);
      this.debug(`local closed from ${remote.remoteAddress}:${remote.remotePort}`);
      localDone.accept();
    };
    const localError = (err) => {
      local.removeListener('error', localError);
      local.removeListener('close', localClose);
      remote.end();
      this.debug(`local died from ${remote.remoteAddress}:${remote.remotePort}`);
      console.error(err);
      localDone.reject();
    };

    local.once('error', localError);
    local.once('close', localClose);

    remote.pipe(local);
    local.pipe(remote);
    local.resume();
    remote.resume();
    this.connectionsCount++;
    onReady.accept();
    await Promise.all([
      remoteDone.promise,
      localDone.promise,
    ]);
    this.connectionsCount--;
    return;
  }

  async establish() {
    while (true) {
      await timeout(1000);
      if (this.connectionsCount <= this.connectionsLimit) {
        const ready = new Defer<void>();
        console.info("OPEN", this.connectionsCount);
        this.open(ready).then(() => {
          console.info("CLOSED");
        });
        await ready.promise;
      }
    }
  }
}
function timeout(delay: number) {
  return new Promise(accept => setTimeout(accept, delay));
}