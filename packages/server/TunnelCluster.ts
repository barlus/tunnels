import {Socket}       from "@barlus/bone/node/net";
import {TunnelClient} from './TunnelClient';
import {Signal}       from './utils/signal';
import {signal}       from './utils/signal';


export class TunnelCluster {
  private worker: TunnelClient;
  @signal readonly onOpen: Signal<(remote: Socket) => void>;
  @signal readonly onDead: Signal<(reason:string) => void>;
  @signal readonly onError: Signal<(error: Error) => void>;
  constructor(worker: TunnelClient) {
    this.worker = worker;
  }
  debug(message, ...args) {
    //console.info(message, ...args);
  }
  open() {
    let remote_host = this.worker.remoteHost;
    let remote_port = this.worker.remotePort;
    let local_host = this.worker.localHost || 'localhost';
    let local_port = this.worker.localPort;

    this.debug('establishing tunnel %s:%s <> %s:%s', local_host, local_port, remote_host, remote_port);
    // connection to localtunnel server
    const remote = Socket.connect({
      host: remote_host,
      port: remote_port
    });
    remote.setKeepAlive(true,2000);
    remote.on('error', (err) => {
      // emit connection refused errors immediately, because they
      // indicate that the tunnel can't be established.
      if (err.code === 'ECONNREFUSED') {
        this.onError(new Error(`connection refused: ${remote_host}:${remote_port} (check your firewall settings)`));
      }
      remote.end();
    });
    // remote.on('data', (data) => {
    //   const match = data.toString().match(/^(\w+) (\S+)/);
    //   if (match) {
    //     console.info( match[ 1 ],match[ 2 ]);
    //     this.emit('request', {
    //       method: match[ 1 ],
    //       path: match[ 2 ],
    //     });
    //   }
    // });

    // tunnel is considered open when remote connects
    remote.once('connect', () => {
      this.onOpen(remote);
      conn_local();
    });

    const conn_local = () => {
      if (remote.destroyed) {
        this.debug('remote destroyed');
        this.onDead('remote destroyed');
        return;
      }
      this.debug(`connecting locally to ${local_host}:${ local_port}`);
      remote.pause();

      // connection to local http server
      const local = Socket.connect({
        host: local_host,
        port: local_port
      });

      const remote_close = () => {
        this.debug('remote close');
        this.onDead('remote closed');
        local.end();
      };

      remote.once('close', remote_close);
      // TODO some languages have single threaded servers which makes opening up
      // multiple local connections impossible. We need a smarter way to scale
      // and adjust for such instances to avoid beating on the door of the server
      local.once('error', (err) => {
        this.debug('local error %s', err.message);
        local.end();
        remote.removeListener('close', remote_close);
        if (err.code !== 'ECONNREFUSED') {
          return remote.end();
        }
        // retrying connection to local server
        setTimeout(conn_local, 1000);
      });
      local.once('connect', () => {
        this.debug('connected locally');
        remote.resume();
        remote.pipe(local).pipe(remote);
        // when local closes, also get a new remote
        local.once('close', (had_error) => {
          this.debug('local connection closed [%s]', had_error);
        });
      });
    };
  }
}
