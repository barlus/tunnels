import {EventStream}    from "./EventStream";
import {observe,Lambda} from "@barlus/mobx/index";
import {TunnelSessions} from "../../TunnelSessions";
import {inject}         from '@barlus/runtime/inject/decorators';
import {Buffer}         from "@barlus/bone/node/buffer";
import {AsyncQueue}     from "./AsyncQueue";
import {HttpRequest}    from "@barlus/bone/http/request";
import {HttpResponse}   from "@barlus/bone/http/response";

export class SessionEvent extends EventStream {
    [Symbol.asyncIterator]() {
        return this.init();
    }
    @inject sessions:TunnelSessions;
    readonly queue:AsyncQueue;
    readonly onStatus:()=>void;
    readonly disposer:Lambda;
    private  timeout:number;
    constructor(request: HttpRequest, response: HttpResponse){
        super(request,response);
        this.queue = new AsyncQueue();
        this.onStatus = this.sessions.onStatus.attach(()=>this.push());
        this.disposer = observe(this.sessions.clients, ()=> this.push());
    }

    async * init() {
        try{
            yield Buffer.from(this.sendRetry(10000));
            this.push();
            this.ping();
            for await (const data of this.queue){
                yield Buffer.from(this.sendMessage(data));
            }
        }catch (e) {
            console.error(e);
        }
    }

    ping(){
        this.queue.push({event:"ping"});
        this.timeout = setTimeout(this.ping.bind(this),10000);
    }

    push(){
        this.queue.push({
            data:JSON.stringify(this.sessions.toJSON())
        });
    }

    close(){
        if( !this.isClosed ){
            super.close();
            this.queue.done();
            this.sessions.onStatus.detach(this.onStatus);
            this.disposer();
            clearTimeout(this.timeout);
        }
    }
}