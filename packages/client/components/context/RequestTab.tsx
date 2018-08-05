import * as React       from "@barlus/react";
import {PureComponent}  from "@barlus/react/index";
import {Fragment}       from "@barlus/react/index";
import {Table}          from "@barlus/spectre";
import {TableBody}      from "@barlus/spectre";
import {TableRow}       from "@barlus/spectre";
import {TableHeading}   from "@barlus/spectre";
import {TableCell}      from "@barlus/spectre";
import {Panel}          from "@barlus/spectre";
import {PanelBody}      from "@barlus/spectre";
import {Button}         from "@barlus/spectre";
import {PanelHeader}    from "@barlus/spectre";
import {PanelTitle}     from "@barlus/spectre";
import {PanelNav}       from "@barlus/spectre";
import {Tab}            from "@barlus/spectre";
import {TabItem}        from "@barlus/spectre";
import {style}          from "@barlus/styles/index";
import {Request}        from "../../types";
import {Body}           from "./Body";

export class RequestTab extends PureComponent<Request&{onReply?:(e?)=>any}>{
    state = {
        tab:'body' as "body"|"headers"|"raw"
    };
    render(){
        const {method,path,body,headers,onReply = (e?)=>{}} = this.props;
        const {tab} = this.state;
        return (
            <Panel className={style({marginBottom: 30})}>
                <PanelHeader>
                    <PanelTitle>
                        {method} {path} <Button onClick={onReply} className={style({float:'right'})}>Reply</Button>
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