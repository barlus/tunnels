import * as React                   from "@barlus/react";
import {PureComponent,Fragment}     from "@barlus/react";
import {Context as ContextProps}    from "../../types";
import {RequestTab}                 from "./RequestTab";
import {ResponseTab}                from "./ResponseTab";

export class Context extends PureComponent<ContextProps&{onReply?:(id)=>{}}> {

    render() {
        const {request, response, onReply =(id)=>{}} = this.props;
        return (
            <Fragment>
                <RequestTab  {...request} onReply={()=>onReply(this.props.id)} />
                <ResponseTab {...response} />
            </Fragment>
        )
    }
}