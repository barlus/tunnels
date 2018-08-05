import {EventStream}    from "./EventStream";
import {TunnelSessions} from "../../TunnelSessions";
import {inject}         from '@barlus/runtime/inject/decorators';
import {Buffer}         from "@barlus/bone/node/buffer";
import {AsyncQueue}     from "./AsyncQueue";
import {HttpRequest}    from "@barlus/bone/http/request";
import {HttpResponse}   from "@barlus/bone/http/response";
import {TunnelSession} from "../../TunnelSession";
import {decode} from "../../utils/basicAuth";

export class SessionEvent extends EventStream {
    [Symbol.asyncIterator]() {
        return this.init();
    }
    @inject sessions:TunnelSessions;
    readonly queue:AsyncQueue;
    readonly disposerStatus:(status:string)=>void;
    readonly disposerAdd:(client:TunnelSession) => void;
    readonly disposerRemove:(client:TunnelSession) => void;
    private  timeout:number;
    constructor(request: HttpRequest, response: HttpResponse){
        super(request,response);
        this.queue = new AsyncQueue();
        this.disposerStatus = this.sessions.onStatus.attach(()=>this.push());
        this.disposerAdd = this.sessions.onAdd.attach(()=>this.push());
        this.disposerRemove = this.sessions.onRemove.attach(()=>this.push());
    }

    async * init() {
        try{
            yield Buffer.from(this.sendRetry(10000));
            this.auth();
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

    auth(){
        const auth = this.request.headers.get('authorization');
        const [ username ] =  decode(String(auth));
        this.queue.push({
            event:'user',
            data:JSON.stringify({username})
        });
    }

    close(){
        if( !this.isClosed ){
            super.close();
            this.queue.done();
            this.sessions.onStatus.detach(this.disposerStatus);
            this.sessions.onAdd.detach(this.disposerAdd);
            this.sessions.onRemove.detach(this.disposerRemove);
            clearTimeout(this.timeout);
        }
    }
}