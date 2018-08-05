import * as React       from "@barlus/react/index";
import {PureComponent}  from "@barlus/react/index";
import {style}          from "@barlus/styles/index";
import {JsonInspector}  from "../inspectors/JsonInspector";

export class Body extends PureComponent<{
    contentType?:string,
    body:string,
    raw?:boolean
}>{
    render(){
        const { contentType, body,raw = false } = this.props;
        try {
            switch (String(contentType).trim().toLowerCase()){
                case 'application/json':
                    return (
                        <div className={style({margin:'1em 0px'})}>
                            {raw ?
                                <pre><code>{JSON.stringify(JSON.parse(body), null, 2)}</code></pre> :
                                <JsonInspector
                                    initialExpandedPaths={['root', 'root.*','root.*.*']}
                                    data={JSON.parse(body)}
                                />
                            }
                        </div>
                    );
                default:
                    return <pre><code>{body}</code></pre>
            }
        }catch (e) {
            return <pre><code>{body}</code></pre>
        }
    }
}