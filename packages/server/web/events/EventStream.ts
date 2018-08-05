import {HttpRequest}    from "@barlus/bone/http/request";
import {HttpResponse}   from "@barlus/bone/http/response";

export class EventStream {
    isClosed:boolean;
    lastEventId: number;
    request: HttpRequest;
    response: HttpResponse;
    constructor(request: HttpRequest, response: HttpResponse) {
        this.isClosed = false;
        this.request = request;
        this.response = response;
        this.lastEventId = parseInt(request.headers.get('last-event-id') as string || '0');
        this.response.setStatus(200, "OK");
        this.response.headers.set('Content-Type', 'text/event-stream; charset=utf-8');
        const onceAbort = this.request.onAbort.attach(()=>{
            this.request.onAbort.detach(onceAbort);
            this.close();
        });
        const onceClose = this.request.onClose.attach(()=>{
            this.request.onAbort.detach(onceClose);
            this.close();
        });
        const onClose = this.response.onClose.attach(()=>{
            this.response.onClose.detach(onClose);
            this.close();
        })
    }
    encode(value) {
        return String(value);
    }
    sendComment(text) {
        return this.send({
            field: '',
            value: text,
            encode: String
        });
    }
    sendEvent(event) {
        return this.send({
            field: 'event',
            value: event,
            encode: String
        });
    }
    sendData(data) {
        return this.send({
            field: 'data',
            value: data
        });
    }
    sendId(id: number) {
        this.lastEventId = id;
        return this.send({
            field: 'id',
            value: id,
            encode: String
        });
    }
    sendRetry(millisecs: number) {
        return this.send({
            field: 'retry',
            value: millisecs,
            encode: String
        });
    }
    sendMessage(opts: { id?: number, event?: string, retry?: number, data: any }) {
        const pack = [];
        if (opts.event) {
            pack.push(this.sendEvent(opts.event));
        }
        if (opts.id) {
            pack.push(this.sendId(opts.id));
        }
        if (opts.retry) {
            pack.push(this.sendRetry(opts.retry));
        }
        pack.push(this.sendData(opts.data));
        return pack.join('');
    }
    send(opts = {} as {
        value?: any,
        field?: string;
        encode?(value: any): string
    }) {
        const chunks = [];
        opts.value = opts.value || '';
        opts.field = (typeof opts.field === 'string') ? opts.field : 'data';
        opts.value = (typeof opts.encode === 'function') ? opts.encode(opts.value) : this.encode(opts.value);
        opts.value.split("\n").forEach((line) => {
            chunks.push(opts.field + ': ' + line + '\n');
        });
        if (opts.field == 'data') {
            chunks.push('\n');
        }
        return chunks.join('');
    }
    keepAlive() {
        this.sendComment('Keep-Alive');
    }
    close(){
        this.isClosed = true;
    };

}