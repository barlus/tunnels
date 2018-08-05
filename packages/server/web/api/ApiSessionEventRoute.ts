import {route}          from '@barlus/bone/http/handlers/router';
import {ApiRoute}       from './ApiRoute';
import {SessionEvent}   from "../events/SessionEvent";

@route("/events/session")
export class ApiSessionEventRoute extends ApiRoute {
    @route.get
    async getEvents() {
        return new SessionEvent(
            this.context.request,
            this.context.response
        );
    }
}

