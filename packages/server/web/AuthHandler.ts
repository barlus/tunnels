import {Handler}        from '@barlus/bone/http/application';
import {Context}        from '@barlus/bone/http/context';
import {injectable}     from '@barlus/runtime/inject/decorators';
import {singleton}      from '@barlus/runtime/inject/decorators';
import {Config}         from './Config';
import {decode}         from "../utils/basicAuth";


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
      const unauthorized = ()=>{
          cnx.response.setStatus(401,'Unauthorized');
          cnx.response.headers.set('WWW-Authenticate',`Basic realm="${this.config.domain}", charset="UTF-8"`);
          cnx.response.headers.set('Content-Type',`application/json`);
          cnx.response.setBody(JSON.stringify({
              error:'Invalid Credentials'
          }))
      };
      if(!auth){
          unauthorized();
      }else{
        const { users } = this.config;
        const [ username, password ] =  decode(String(auth));
        if( users[username] === password ){
            return next();
        }
        unauthorized();
      }
    } catch (ex) {
      return next()
    }
  }

}