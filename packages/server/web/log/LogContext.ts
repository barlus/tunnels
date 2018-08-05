import {Context}            from '@barlus/bone/http/context';
import {Buffer}             from "@barlus/bone/node/buffer";
import {HttpRequest}        from "@barlus/bone/http/request";
import {HttpResponse}       from "@barlus/bone/http/response";
import {LogRequest}         from "./LogRequest";
import {LogResponse}        from "./LogResponse";
import {ClientRequest}      from "@barlus/bone/node/http";
import {IncomingMessage}    from "@barlus/bone/node/http";
import {AsyncStream}        from "@barlus/bone/node/stream";

export class LogContext extends Context{
    readonly request:LogRequest;
    readonly response:LogResponse;
    private startAt:Date;
    private endAt:Date;
    public id:string;
    public wait:Promise<any>;
    private acceptRequest:Function;
    private acceptResponse:Function;

    constructor(request:LogRequest,response:LogResponse){
       super(request,response);
       this.startAt = new Date();
       this.endAt   = new Date();
       this.id = Math.round(Math.random()*Number.MAX_SAFE_INTEGER).toString(36);
       this.wait = Promise.all([
            new Promise(accept=>this.acceptRequest = accept),
            new Promise(accept=>this.acceptResponse = accept)
       ]);
    }
    async transmit(request:HttpRequest,clientReq:ClientRequest);
    async transmit(response:HttpResponse,clientRes:IncomingMessage);
    async transmit(input:HttpResponse|HttpRequest,stream:IncomingMessage|ClientRequest){
        if( input instanceof HttpResponse && stream instanceof IncomingMessage){
            const response  = input;
            const clientRes = stream;
            response.setStatus(clientRes.statusCode, clientRes.statusMessage);
            response.headers.patch(clientRes.headers);
            this.response.setHeaders(response.headers);
            this.response.setStatus(response.status,response.message);
            response.setBody(this.generate(stream));
            this.endAt = new Date();
        }
        if( input instanceof HttpRequest && stream instanceof ClientRequest ){
            return await AsyncStream.write(this.generate(input), stream);
        }
    }
    async generate(request:HttpRequest);
    async generate(clientRes:IncomingMessage);
    async * generate(stream){
        if( stream instanceof IncomingMessage ){
            const chunks:Buffer[] = [];
            for await (const chunk of AsyncStream.from(stream)) {
                chunks.push(chunk);
                yield chunk;
            }
            this.response.setBody(Buffer.concat(chunks));
            this.acceptResponse();
        }
        if( stream instanceof HttpRequest ){
            const chunks:Buffer[] = [];
            for await (const chunk of stream.body) {
                chunks.push(chunk);
                yield chunk;
            }
            this.request.setBody(Buffer.concat(chunks));
            this.acceptRequest();
        }
    }
    async toJSON(){
        return {
            id:this.id,
            duration : this.endAt.getTime() - this.startAt.getTime(),
            request  : await this.request.toJSON(),
            response : await this.response.toJSON()
        }
    }
}