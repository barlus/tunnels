import {LogContext}     from "./LogContext";
import {signal, Signal} from "../../utils/signal";

export class History {
    @signal readonly onChange: Signal<(context:this) => void>;
    contexts: LogContext[] = [];
    maxSize: number = 50;

    async push(context: LogContext) {
        await context.wait;
        this.contexts.unshift(context);
        if (this.contexts.length > this.maxSize) {
            this.contexts.pop();
        }
        this.onChange(this);
    }

    get(cid):LogContext{
       return this.contexts.find((context:LogContext)=>context.id == cid);
    }

    clear() {
        this.contexts = [];
        this.onChange(this);
    }

    async toJSON() {
        return await Promise.all(this.contexts.map(async (context: LogContext) => {
            return await context.toJSON();
        }))
    }
}