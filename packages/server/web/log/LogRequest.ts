import {HttpRequest}    from '@barlus/bone/http/request';
import {Buffer}         from "@barlus/bone/node/buffer";
import {HttpUrl}        from "@barlus/bone/http/url";
import {URL}            from "@barlus/bone/node/url";

export class LogRequest extends HttpRequest {
    state:any = {};
    async form(){
        if(typeof this.state.form=='undefined'){
            let body = await this.text();
            if(body!==null){
                this.state.form = HttpUrl.query(body);
            }else{
                this.state.form = null;
            }
        }
        return this.state.form;
    }
    async json(){
        if(typeof this.state.json=='undefined'){
            let body = await this.text();
            if(body!==null){
                this.state.json = JSON.parse(body)
            }else{
                this.state.json = null;
            }
        }
        return this.state.json;
    }
    async getBody():Promise<Buffer>{
        if(typeof this.state.body=='undefined'){
            if(this.body){
                const chunks:Buffer[] = [];
                for await(const chunk of this.body){
                    chunks.push(chunk);
                }
                this.state.body = Buffer.concat(chunks);
            }else{
                this.state.body = null;
            }
        }
        return this.state.body;
    }
    async text(){
        if(typeof this.state.text=='undefined'){
            let body = await this.getBody();
            if(body!==null){
                this.state.text = body.toString('utf8')
            }else{
                this.state.text = null;
            }
        }
        return this.state.text;
    }
    async toJSON(){
        return {
            path : new URL(this.url.toString()).pathname,
            method:this.method,
            url:this.url,
            headers:this.headers.toJSON(),
            body: await this.text()
        }
    }
}