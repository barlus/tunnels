import * as React                   from "@barlus/react";
import {PureComponent}              from "@barlus/react";
import {style}                      from "@barlus/styles";
import {Container}                  from "@barlus/spectre";
import {Columns}                    from "@barlus/spectre";
import {Column}                     from "@barlus/spectre";
import {Table}                      from "@barlus/spectre";
import {TableBody}                  from "@barlus/spectre";
import {TableHeader}                from "@barlus/spectre";
import {TableRow}                   from "@barlus/spectre";
import {TableHeading}               from "@barlus/spectre";
import {TableCell}                  from "@barlus/spectre";
import {Button}                     from "@barlus/spectre";
import {Theme}                      from "@barlus/spectre/layout/theme";
import {classes}                    from "@barlus/spectre/utils/classes";
import {Context as ContextProps}    from "../types";
import {SessionProps}               from "../types";
import {Context}                    from "./context/Context";

export class Session extends PureComponent<SessionProps> {
    private evtSource:EventSource;
    state = {
        history: [] as ContextProps[],
        context: null as ContextProps
    };

    async componentDidMount() {
        this.evtSource = new EventSource(`/api/events/session/${this.props.id}/history`, { withCredentials: true } );
        this.evtSource.onmessage = ({data})=> {
            try {
                const history = JSON.parse(data);
                this.setState({history});
            }catch (e) {
                console.error(e)
            }
        };
    }

    async clear(){
        this.setState({history:[]});
        await fetch(`/api/session/${this.props.id}/history`, {
            method:"DELETE",
            credentials: "same-origin"
        });
    }

    async reply(cid){
        await fetch(`/api/session/${this.props.id}/history/${cid}/reply`, {
            method:"POST",
            credentials: "same-origin"
        });
    }

    componentWillUnmount(){
        this.evtSource.close();
    }

    render() {
        const {context,history} = this.state;
        return (
            <Container className={style({padding:'.4rem'})}>
                <Column className={Theme.col11}>
                    <Columns>
                        <Column className={classes(Theme.col6, style({padding: '.4rem'}))}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeading>All Requests</TableHeading>
                                        <TableHeading>
                                            <Button onClick={()=>this.clear()}>Clear <i className="icon icon-delete"/></Button>
                                        </TableHeading>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((context: ContextProps) => (
                                        <TableRow
                                            active={context.id === Object(this.state.context).id}
                                            key={context.id}
                                            onClick={()=>this.setState({context})}
                                            className={style({cursor: "pointer"})}
                                        >
                                            <TableCell>{context.request.method}  {context.request.path}</TableCell>
                                            <TableCell>{context.response.status} {context.response.message} / {context.duration} ms</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Column>
                        <Column className={classes(Theme.col6, style({padding: '.4rem'}))}>
                            {context && <Context {...context} onReply={id=>this.reply(id)} />}
                        </Column>
                    </Columns>
                </Column>
            </Container>
        )
    }
}