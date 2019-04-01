import {route}    from '@barlus/bone/http/handlers/router';
import {ApiRoute} from './ApiRoute';
import {decode}   from "../../utils/basicAuth";


@route("/:subdomain")
export class ApiRegisterRoute extends ApiRoute {
  @route.get
  async getToken(subdomain: string) {
    try {
      const auth = this.context.request.headers.get('authorization');
      const [ username ] = decode(String(auth));
      const session = await this.sessions.createSession(subdomain, username);
      return this.response(session.toJSON());
    } catch (e) {
      console.error(e.message);
      return this.response({
        code: 429,
        error: e.message
      }, 429);
    }

  }
}