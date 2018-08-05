import {Context}        from '@barlus/bone/http/context';
import {Http}           from '@barlus/bone/node/http';
import {TunnelAgent}    from './TunnelAgent';
import {signal, Signal} from './utils/signal';
import {LogRequest}     from "./web/log/LogRequest";
import {LogResponse}    from "./web/log/LogResponse";
import {LogContext}     from "./web/log/LogContext";
import {History}        from "./web/log/History";

// A client encapsulates req/res handling using an agent
//
// If an agent is destroyed, the request handling will error
// The caller is responsible for handling a failed request

export class TunnelSession {
    graceTimeout: any;
    agent: TunnelAgent;
    id: string;
    domain: string;
    url: string;
    port: number;
    status: 'offline' | 'online';
    @signal onClose: Signal<() => void>;
    @signal onStatus: Signal<(status:string) => void>;
    debugging: boolean = true;
    history : History;
    user: string;

    debug(message: string, ...args) {
        if (this.debugging) {
            console.debug('TunnelSession', message, ...args)
        }
    }

    constructor(id: string, domain: string,user: string) {
        //super();
        this.id = id;
        this.domain = domain;
        this.user = user;
        this.url = `https://${id}.${domain}`;
        this.agent = new TunnelAgent({
            clientId: id,
            maxSockets: 10,
        });
        this.history = new History();
        this.status = 'offline';
        this.onStatus(this.status);
        // client is given a grace period in which they can connect before they are _removed_
        this.graceTimeout = setTimeout(() => this.close(), 5000);
        this.graceTimeout.unref();
        this.agent.onOnline.attach(() => {
            this.status = 'online';
            this.onStatus(this.status);
            this.debug('client online %s', id);
            clearTimeout(this.graceTimeout);
        });
        this.agent.onOffline.attach(() => {
            this.status = 'offline';
            this.onStatus(this.status);
            this.debug('client offline %s', id);
            // if there was a previous timeout set, we don't want to double trigger
            clearTimeout(this.graceTimeout);
            // client is given a grace period in which they can re-connect before they are _removed_
            this.graceTimeout = setTimeout(() => this.close(), 5000);
            this.graceTimeout.unref();
        });
        // TODO(roman): an agent error removes the client, the user needs to re-connect?
        // how does a user realize they need to re-connect vs some random client being assigned same port?
        this.agent.onError.attach(() => this.close());
    }

    close() {
        clearTimeout(this.graceTimeout);
        this.agent.destroy();
        this.onClose();
    }

    async handleRequest(context: Context) {
        const {request, response} = context;
        const logContext = new LogContext(
            new LogRequest(request.method,request.url,request.headers),
            new LogResponse()
        );
        this.debug(`> ${request.url.toString()}`);
        const opt = {
            path: `${request.url.pathname}${request.url.search}`,
            agent: this.agent,
            method: request.method,
            headers: request.headers.toJSON()
        };

        let accept, reject;
        const wait = new Promise((a, r) => {
            accept = a;
            reject = r;
        });
        const clientReq = Http.request(opt, (clientRes) => {
            this.debug(`< ${request.url.toString()} ${clientRes.statusCode}`);
            logContext.transmit(response,clientRes)
                .catch(console.error);
            accept();
        });
        await logContext.transmit(request, clientReq);
        await wait;
        this.history.push(logContext);
    }

    handleUpgrade(req, socket) {
        this.debug('> [up] %s', req.url);
        socket.once('error', (err) => {
            // These client side errors can happen if the client dies while we are reading
            // We don't need to surface these in our logs.
            if (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') {
                return;
            }
            console.error(err);
        });
        this.agent.createConnection({}, (err, conn) => {
            this.debug('< [up] %s', req.url);
            // any errors getting a connection mean we cannot service this request
            if (err) {
                socket.end();
                return;
            }

            // socket met have disconnected while we waiting for a socket
            if (!socket.readable || !socket.writable) {
                conn.destroy();
                socket.end();
                return;
            }

            // websocket requests are special in that we simply re-create the header info
            // then directly pipe the socket data
            // avoids having to rebuild the request and handle upgrades via the http client
            const arr = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
            for (let i = 0; i < (req.rawHeaders.length - 1); i += 2) {
                arr.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
            }

            arr.push('');
            arr.push('');

            // using pump is deliberate - see the pump docs for why

            //pump(conn, socket);
            //pump(socket, conn);
            conn.pipe(socket);
            socket.pipe(conn);

            conn.write(arr.join('\r\n'));
        });
    }

    async listen() {
        this.port = await this.agent.listen();
        return this;
    }

    toJSON() {
        const socks = [];
        for (const sock of this.agent.availableSockets) {
            socks.push({
                remoteAddress: sock.remoteAddress,
                remotePort: sock.remotePort,
                localAddress: sock.localAddress,
                localPort: sock.localPort,
            })
        }
        return {
            id: this.id,
            url: this.url,
            port: this.port,
            domain: this.domain,
            maxSockets: this.agent.maxTcpSockets,
            socketsCount: this.agent.connectedSockets,
            status: this.status,
            user: this.user,
        }
    }
}
