import {Context}                from '@barlus/bone/http';
import {RouteHandler}           from '@barlus/bone/http/handlers/router';
import {injectable, singleton}  from "@barlus/runtime/inject/decorators";
import {ApiRegisterRoute}       from './ApiRegisterRoute';
import {ApiStatusRoute}         from './ApiStatusRoute';
import {ApiHistoryRoute}        from './ApiHistoryRoute';
import {ApiHistoryRouteReply}   from './ApiHistoryRoute';
import {ApiSessionEventRoute}   from "./ApiSessionEventRoute";
import {ApiHistoryEventRoute}   from "./ApiHistoryEventRoute";


@singleton
@injectable
export class ApiRouter extends RouteHandler {
  constructor() {
    const params = {
      apiPath: "/api",
      resources: [
          ApiSessionEventRoute,
          ApiHistoryEventRoute,
          ApiHistoryRoute,
          ApiStatusRoute,
          ApiRegisterRoute,
          ApiHistoryRouteReply
      ],
    };
    super(params);
  }
  async handle(context: Context, next: () => Promise<any>) {
    // Access-Control-Allow-Origin: *
    // Access-Control-Allow-Methods: POST, GET
    // Access-Control-Allow-Headers: X-PINGOTHER, Content-Type
    // Access-Control-Max-Age: 86400
    console.info(context.request.method, context.request.url.pathname);
    context.response.headers.set('Access-Control-Allow-Origin', '*');
    if (context.request.method == 'OPTIONS') {
      context.response.headers.set('Access-Control-Allow-Origin', '*');
      context.response.headers.set('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
      context.response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      context.response.headers.set('Access-Control-Max-Age', '86400');
      context.response.setStatus(200, 'OK');
      context.response.setBody('');
      return;
    } else {
      return super.handle(context, next);
    }

  }
}