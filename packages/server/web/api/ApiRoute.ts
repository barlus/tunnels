import {Resource}       from '@barlus/bone/http/handlers/router';
import {Buffer}         from '@barlus/bone/node/buffer';
import {injectable}     from '@barlus/runtime/inject/decorators';
import {TunnelSessions} from '../../TunnelSessions';

@injectable
export class ApiRoute extends Resource {

  readonly sessions: TunnelSessions;
  constructor(sessions: TunnelSessions){
    super();
    this.sessions = sessions;
  }

  async response(data: any, status = 200, message = 'OK') {
    if (data instanceof Error) {
      this.context.response.setStatus(500, 'Internal Error');
      data = this.error(data)
    } else {
      this.context.response.setStatus(status, message);
    }
    if (data && typeof data == 'object') {
      data = JSON.stringify(data);
      this.context.response.headers.set('Content-Type', 'application/json');
      this.context.response.headers.set('Content-Length', `${Buffer.byteLength(data)}`);
    }
    return data;
  }
  error(error: Error) {
    return {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack.split('\n')
    }
  }
}

