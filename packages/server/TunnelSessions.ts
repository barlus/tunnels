import {injectable} from '@barlus/runtime/inject/decorators';
import {singleton} from '@barlus/runtime/inject/decorators';
import {TunnelSession} from './TunnelSession';
import {Config} from './web/Config';
import {signal, Signal} from "./utils/signal";


@singleton
@injectable
export class TunnelSessions {

    readonly config: Config;
    readonly clients = new Map<string, TunnelSession>();
    @signal onStatus: Signal<(status:string) => void>;
    @signal onAdd: Signal<(client:TunnelSession) => void>;
    @signal onRemove: Signal<(client:TunnelSession) => void>;

    constructor(config: Config) {
        this.config = config;
    }

    debug(message: string, ...args) {
        console.debug(`TunnelSessions`, message, ...args)
    }

    // create a new tunnel with `id`
    // if the id is already used, a random id is assigned
    // if the tunnel could not be created, throws an error
    async newClient(id: string,username: string): Promise<TunnelSession> {
        // can't ask for id already is use
        if (this.clients.has(id)) {
            throw new Error('id already is use');
        }
        const client = new TunnelSession(id, this.config.domain, username);
        // add to clients map immediately
        // avoiding races with other clients requesting same id
        this.clients.set(id, client);
        this.onAdd(client);
        const disposer = client.onStatus.attach((status)=>{
            this.onStatus(status);
        });
        client.onClose.attach(() => {
            client.onStatus.detach(disposer);
            this.removeClient(id);
        });
        // try/catch used here to remove client id
        try {
            await client.listen();
            return client;
        }
        catch (err) {
            client.onStatus.detach(disposer);
            this.removeClient(id);
            // rethrow error for upstream to handle
            throw err;
        }
    }

    removeClient(id: string): TunnelSession {
        this.debug(`removing client: ${id}`);
        const client = this.clients.get(id);
        if (!client) {
            return;
        }
        this.clients.delete(id);
        this.onRemove(client);
        client.close();
    }

    hasClient(id: string): boolean {
        return this.clients.has(id);
    }

    getClient(id): TunnelSession {
        return this.clients.get(id);
    }

    toJSON() {
        const sessions = [];
        this.clients.forEach(c => {
            sessions.push(c.toJSON());
        });
        return sessions;
    }
}
