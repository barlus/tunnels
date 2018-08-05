import {route}    from '@barlus/bone/http/handlers/router';
import {ApiRoute} from './ApiRoute';
import {decode} from "../../utils/basicAuth";

@route("/:subdomain")
export class ApiRegisterRoute extends ApiRoute {
  @route.get
  async getToken(subdomain:string) {
    const auth = this.context.request.headers.get('authorization');
    const [ username ] =  decode(String(auth));
    const session = await this.sessions.newClient(subdomain,username);
    return this.response(session.toJSON());
  }
}