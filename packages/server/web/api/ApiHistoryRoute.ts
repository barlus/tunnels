import {route}          from '@barlus/bone/http/handlers/router';
import {ApiRoute}       from './ApiRoute';
import {LogContext}     from "../log/LogContext";
import {LogRequest}     from "../log/LogRequest";
import {LogResponse}    from "../log/LogResponse";

@route("/session/:id/history")
export class ApiHistoryRoute extends ApiRoute {
    @route.get
    async getHistory(id) {
        const session = this.sessions.getClient(id);
        return this.response(await session.history.toJSON());
    }

    @route.detete
    async deleteHistory(id) {
        const session = this.sessions.getClient(id);
        return this.response(session.history.clear());
    }
}

@route("/session/:id/history/:hid/reply")
export class ApiHistoryRouteReply extends ApiRoute {

    @route.post
    async postReply(id, hid) {
        const session = this.sessions.getClient(id);
        const context = session.history.get(hid);
        if (context) {
            const request = new LogRequest(
                context.request.method,
                context.request.url,
                context.request.headers
            );
            request.setBody(await context.request.getBody());
            const cnt = new LogContext(request, new LogResponse());
            await session.handleRequest(cnt);
            return this.response(await cnt.response.toJSON(), 201);
        }
        return this.response({}, 404);
    }
}