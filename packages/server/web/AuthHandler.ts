import {Handler}        from '@barlus/bone/http/application';
import {Context}        from '@barlus/bone/http/context';
import {Buffer}         from '@barlus/bone/node/buffer';
import {injectable}     from '@barlus/runtime/inject/decorators';
import {singleton}      from '@barlus/runtime/inject/decorators';
import {Config}         from './Config';


@singleton
@injectable
export class AuthHandler implements Handler {
  readonly config: Config;
  constructor(config: Config) {
    this.config = config;
  }
  async handle(cnx: Context, next: () => Promise<any>) {
    try {
      const auth = cnx.request.headers.get('authorization');
      if(!auth){
        cnx.response.setStatus(401,'Unauthorized');
        cnx.response.headers.set('WWW-Authenticate',`Basic realm="${this.config.domain}", charset="UTF-8"`);
        cnx.response.headers.set('Content-Type',`application/json`);
        cnx.response.setBody(JSON.stringify({
          error:'Invalid Credentials'
        }))
      }else{
        console.info(auth);
        return next();
      }
    } catch (ex) {
      return next()
    }
  }

}