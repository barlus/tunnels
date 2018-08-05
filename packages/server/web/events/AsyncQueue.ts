import {Buffer} from "@barlus/bone/node/buffer";

export class AsyncQueue implements AsyncIterable<Buffer>{
    [Symbol.asyncIterator](){
        return this;
    }
    listening:boolean = true;
    pullQueue:{resolve,reject}[] = [];
    pushQueue:any[] = [];
    pull(){
        return new Promise<IteratorResult<Buffer>>((resolve,reject) => {
            if (this.pushQueue.length !== 0) {
                resolve({value: this.pushQueue.shift(), done: false});
            } else {
                this.pullQueue.push({resolve,reject});
            }
        });
    }
    push(data: any){
        if (this.pullQueue.length !== 0) {
            this.pullQueue.shift().resolve({value: data, done: false});
        } else {
            this.pushQueue.push(data);
        }
    }
    done(error?: Error){
        if (this.listening) {
            this.listening = false;
            this.pullQueue.forEach((p) => {
                if (error) {
                    p.reject(error);
                } else {
                    p.resolve({value: undefined, done: true})
                }
            });
            this.pullQueue.length = 0;
            this.pushQueue.length = 0;
        }
    }
    async next(value?:any) {
        if (this.listening) {
            return this.pull()
        } else {
            return this.return()
        }
    }
    async return() {
        return {value: undefined, done: true};
    }
    async throw(error) {
        this.done(error);
        return Promise.reject(error);
    }

}