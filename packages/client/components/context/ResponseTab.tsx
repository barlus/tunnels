import * as React       from "@barlus/react";
import {PureComponent}  from "@barlus/react/index";
import {Fragment}       from "@barlus/react/index";
import {Response}       from "../../types";
import {classes}        from "@barlus/spectre/utils/classes";
import {Table}          from "@barlus/spectre";
import {TableBody}      from "@barlus/spectre";
import {TableRow}       from "@barlus/spectre";
import {TableHeading}   from "@barlus/spectre";
import {TableCell}      from "@barlus/spectre";
import {Panel}          from "@barlus/spectre";
import {PanelBody}      from "@barlus/spectre";
import {PanelHeader}    from "@barlus/spectre";
import {PanelTitle}     from "@barlus/spectre";
import {PanelNav}       from "@barlus/spectre";
import {Tab}            from "@barlus/spectre";
import {TabItem}        from "@barlus/spectre";
import {style}          from "@barlus/styles/index";
import {Body}           from "./Body";

export class ResponseTab extends PureComponent<Response>{
    state = {
        tab:'body' as "body"|"headers"|"raw"
    };
    render(){
        const {status,message,body,headers} = this.props;
        const {tab} = this.state;
        return (
            <Panel>
                <PanelHeader>
                    <PanelTitle className={classes({'text-error':status>=400,'text-success':status<400})}>
                        {status} {message}
                    </PanelTitle>
                </PanelHeader>
                <PanelNav>
                    <Tab block={true}>
                        <TabItem active={tab === 'body'} onClick={()=>this.setState({tab:'body'})}><a href="javascript:;">Body</a></TabItem>
                        <TabItem active={tab === 'headers'} onClick={()=>this.setState({tab:'headers'})}><a href="javascript:;">Headers</a></TabItem>
                        <TabItem active={tab === 'raw'} onClick={()=>this.setState({tab:'raw'})}><a href="javascript:;">Raw</a></TabItem>
                    </Tab>
                </PanelNav>
                <PanelBody>
                    {tab === 'body' && <Body body={body} contentType={headers['content-type']} />}
                    {tab === 'headers' &&
                    <Table className={style({
                        whiteSpace: "nowrap",
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    })}>
                        <TableBody>
                            {
                                Object.keys(headers).map((key)=>
                                    <TableRow key={key}>
                                        <TableHeading>{key}</TableHeading>
                                        <TableCell>{headers[key]}</TableCell>
                                    </TableRow>
                                )
                            }
                        </TableBody>
                    </Table>
                    }
                    {tab === 'raw' &&
                    <Fragment>
                        <pre>
                            {
                                Object.keys(headers).map((key)=>
                                    `${key}: ${headers[key]}`
                                ).join('\n')
                            }
                        </pre>
                        <Body body={body} contentType={headers['content-type']} raw={true} />
                    </Fragment>
                    }
                </PanelBody>
            </Panel>
        )
    }
}