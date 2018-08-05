import {route}    from '@barlus/bone/http/handlers/router';
import {ApiRoute} from './ApiRoute';

@route("/status")
export class ApiStatusRoute extends ApiRoute {
  @route.get
  async getStatus() {
    return this.response(this.sessions.toJSON());
  }
}