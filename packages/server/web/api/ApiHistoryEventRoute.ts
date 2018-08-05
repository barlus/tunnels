import {route}          from '@barlus/bone/http/handlers/router';
import {ApiRoute}       from './ApiRoute';
import {HistoryEvent}   from "../events/HistoryEvent";

@route("/events/session/:id/history")
export class ApiHistoryEventRoute extends ApiRoute {
    @route.get
    async getEvents(id) {
        const session = this.sessions.getClient(id);
        if( !session ){
            return this.response("Not Found",404);
        }
        return new HistoryEvent(
            this.context.request,
            this.context.response,
            session
        );
    }
}

