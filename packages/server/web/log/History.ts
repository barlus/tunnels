import {LogContext} from "./LogContext";
import {observable} from "@barlus/mobx/index";

export class History {
    @observable contexts: LogContext[] = [];
    maxSize: number = 10;

    async push(context: LogContext) {
        await context.wait;
        this.contexts.unshift(context);
        if (this.contexts.length > this.maxSize) {
            this.contexts.pop();
        }
    }

    get(cid):LogContext{
       return this.contexts.find((context:LogContext)=>context.id == cid);
    }

    clear() {
        this.contexts = [];
    }

    async toJSON() {
        return await Promise.all(this.contexts.map(async (context: LogContext) => {
            return await context.toJSON();
        }))
    }
}