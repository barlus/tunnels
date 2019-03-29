import {Fs}           from '@barlus/bone/node/fs';
import {Path}         from '@barlus/bone/node/path';
import {process}      from '@barlus/bone/node/process';
import {injectable}   from '@barlus/runtime/inject/decorators';
import {singleton}    from '@barlus/runtime/inject/decorators';
import {container}    from '@barlus/runtime/inject/injection';
import {TunnelClient} from './TunnelClient';
import {Config}       from './web/Config';
import {WebServer}    from './web/WebServer';
import argv           from "./utils/argv";


@singleton
@injectable
class TunnelCli {

  private node: string;
  private app: string;
  private command: string;
  private args: string[];
  private config: Config;
  private server: WebServer;
  constructor(server: WebServer, config: Config) {
    const [ node, app, command, ...args ] = process.argv;
    this.config = config;
    this.node = node;
    this.app = app;
    this.command = command;
    this.args = args;
    this.server = server;
  }

  async run() {
    switch (this.command) {
      case 'serve':
        return await this.serve(...this.args);
      case 'connect':
        return await this.connect(...this.args);
    }
  }
  async serve(configPath?: string) {
    const dirname = Path.dirname(configPath);
    const config = JSON.parse(Fs.readFileSync(configPath, 'utf8'));
    config.cert = Fs.readFileSync(Path.resolve(dirname,config.cert));
    config.key = Fs.readFileSync(Path.resolve(dirname,config.key));
    Object.assign(this.config, config);
    await this.server.run();
    // const server = new TunnelServer();
    // await server.run();
  }
  async connect(...args) {
    const {
        _,
        subdomain = `tunnel-${Math.floor(Math.random() * 100)}`,
        domain = 'mamble.io',
        host = '0.0.0.0',
        auth,
    } = argv(args);
    const url = `https://${auth}@${domain}/api/${subdomain}`;
    const [port = 80 ] = _;
    console.info("server:",`https://${domain}`);
    console.info("your url is:",`https://${subdomain}.${domain}`);
    const worker = new TunnelClient(url, port, host);
    await worker.open();
  }
}

container.resolve(TunnelCli).run().catch(console.error);