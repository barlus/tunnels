import {injectable} from '@barlus/runtime/inject/decorators';
import {singleton} from '@barlus/runtime/inject/decorators';
import {TunnelSession} from './TunnelSession';
import {Config} from './web/Config';
import {observable,observe} from "@barlus/mobx";
import {signal, Signal} from "./utils/signal";


@singleton
@injectable
export class TunnelSessions {

    readonly config: Config;
    @observable clients = new Map<string, TunnelSession>();
    @signal onStatus: Signal<() => void>;

    constructor(config: Config) {
        this.config = config;
    }

    debug(message: string, ...args) {
        console.debug(`TunnelSessions`, message, ...args)
    }

    // create a new tunnel with `id`
    // if the id is already used, a random id is assigned
    // if the tunnel could not be created, throws an error
    async newClient(id: string): Promise<TunnelSession> {
        // can't ask for id already is use
        if (this.clients.has(id)) {
            throw new Error('id already is use');
        }
        const client = new TunnelSession(id, this.config.domain);
        // add to clients map immediately
        // avoiding races with other clients requesting same id
        this.clients.set(id, client);
        const disposer = observe(client,'status',this.onStatus);
        client.onClose.attach(() => {
            disposer();
            this.removeClient(id);
        });
        // try/catch used here to remove client id
        try {
            await client.listen();
            return client;
        }
        catch (err) {
            disposer();
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
