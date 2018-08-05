import {EventStream}        from "./EventStream";
import {Lambda, observe}    from "@barlus/mobx/index";
import {Buffer}             from "@barlus/bone/node/buffer";
import {HttpRequest}        from "@barlus/bone/http/request";
import {HttpResponse}       from "@barlus/bone/http/response";
import {AsyncQueue}         from "./AsyncQueue";
import {TunnelSession}      from "../../TunnelSession";

export class HistoryEvent extends EventStream {
    [Symbol.asyncIterator]() {
        return this.init();
    }
    readonly queue:AsyncQueue;
    readonly session:TunnelSession;
    readonly disposer:Lambda;
    readonly onReset:Lambda;
    private  timeout:number;

    constructor(request: HttpRequest, response: HttpResponse,session:TunnelSession){
        super(request,response);
        this.session = session;
        this.queue = new AsyncQueue();
        this.onReset = observe(this.session.history,'contexts', async change => {
            this.close();
        });
        this.disposer = observe(this.session.history.contexts, async change => {
            await this.push();
        });
    }

    async * init() {
        try {
            yield Buffer.from(this.sendRetry(10000));
            await this.push();
            this.ping();
            for await (const data of this.queue){
                yield Buffer.from(this.sendMessage(data));
            }
        }catch (e) {
            this.close();
            console.error(e);
        }
    }

    async push(){
        this.queue.push({
            data:JSON.stringify(await this.session.history.toJSON())
        });
    }

    ping(){
        this.queue.push({event:"ping"});
        this.timeout = setTimeout(this.ping.bind(this),10000);
    }

    close(){
        if( !this.isClosed ){
            super.close();
            this.queue.done();
            this.onReset();
            this.disposer();
            clearTimeout(this.timeout);
        }
    }
}