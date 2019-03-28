import {Fs}              from '@barlus/bone/node/fs';
import {Https}           from '@barlus/bone/node/https';
import {container}       from "@barlus/runtime/inject/injection";
import {injectable}      from "@barlus/runtime/inject/decorators";
import {singleton}       from "@barlus/runtime/inject/decorators";
import {HttpApplication} from "@barlus/bone/http";
import {ApiRouter}       from './api/ApiRouter';
import {AuthHandler}     from './AuthHandler';
import {Config}          from './Config';
import {TunnelHandler}   from './TunnelHandler';
import {WebHandler}      from './WebHandler';
import {process}         from "@barlus/bone/node/process";
import {ProjectRoute}    from "@barlus/bone/http/handlers/projects";


declare const __dirname;

@singleton
@injectable
export class WebServer extends HttpApplication {
  config: Config;

  async run() {
    console.info("LISTEN", this.config);
    await this.listen(this.config.port, this.config.address);
    console.info(`https://${this.config.domain}`);
  }

  async listen(...args) {
    const publicDir = `${__dirname}/public`;
    if (Fs.existsSync(publicDir)) {
      console.info(publicDir);
      this.use(new WebHandler({
        root:`${__dirname}/public`
      }));
    } else {
      this.use(new ProjectRoute({
        root: process.cwd(),
        //project:'@qustomerz/admin',
        project: '@barlus/tunnels-client',
        ignore: [ 'typescript' ]
      }));
    }

    const native = Https.createServer({
      cert: this.config.cert,
      key: this.config.key
    }, this.callback());
    await new Promise((accept, reject) => {
      const cleanup = (error) => {
        native.removeListener('listening', cleanup);
        native.removeListener('error', cleanup);
        if (error) {
          reject(error)
        } else {
          accept()
        }
      };
      native.once('listening', cleanup);
      native.once('error', cleanup);
      native.listen(...args)
    });
    Object.assign({ native });
    return native.address();
  }

  constructor(config: Config, router: ApiRouter, tunnels: TunnelHandler, auth: AuthHandler) {
    super();
    this.config = config;
    this.use(tunnels);
    this.use(auth);
    this.use(router);
  }
}
