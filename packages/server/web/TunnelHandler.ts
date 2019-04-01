import {Handler}        from '@barlus/bone/http/application';
import {HttpRequest}    from '@barlus/bone/http';
import {Context}        from '@barlus/bone/http/context';
import {injectable}     from '@barlus/runtime/inject/decorators';
import {singleton}      from '@barlus/runtime/inject/decorators';
import {Pattern}        from '@barlus/runtime/pattern';
import {TunnelSessions} from '../TunnelSessions';
import {Config}         from './Config';


@singleton
@injectable
export class TunnelHandler implements Handler {
    readonly config: Config;
    readonly sessions: TunnelSessions;

    get regexp(): Pattern<boolean> {
        return Pattern.regexp(`:subdomain.${this.config.domain}`, true)
    }

    constructor(config: Config, sessions: TunnelSessions) {
        this.config = config;
        this.sessions = sessions;
    }

    async badGateway(cnx: Context, name: string) {
        cnx.response.setStatus(502, 'Bad Gateway');
        cnx.response.headers.set('Content-Type', 'text/plain');
        cnx.response.setBody(`bad gateway "${name}"`);
    }

    async handle(cnx: Context, next: () => Promise<any>) {
        try {
            const matched = cnx.request.url.hostname.match(this.regexp);
            if (matched) {
                const session = this.sessions.getSession(matched[1]);
                if (!session) {
                    return this.badGateway(cnx, matched[1]);
                } else {
                    await session.handleRequest(cnx);
                }
            } else {
                return next();
            }
        } catch (ex) {
            console.error(ex);
            return next()
        }
    }

    async upgrade(request: HttpRequest, socket) {
        const hostname = request.headers['host'];
        const matched = hostname.match(this.regexp);
        if (!matched) {
            socket.destroy();
            return;
        }
        const session = this.sessions.getSession(matched[1]);
        if (!session) {
            socket.destroy();
        } else {
            await session.handleUpgrade(request, socket);
        }
    }
}