import {route}    from '@barlus/bone/http/handlers/router';
import {ApiRoute} from './ApiRoute';

@route("/:subdomain")
export class ApiRegisterRoute extends ApiRoute {
  @route.get
  async getToken(subdomain:string) {
    console.info(this.context.request.headers.get('authorization'))
    const session = await this.sessions.newClient(subdomain);
    return this.response(session.toJSON());
  }
}