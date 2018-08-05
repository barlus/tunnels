import * as React           from "@barlus/react";
import {OffCanvasSidebar}   from "@barlus/spectre";
import {OffCanvasContent}   from "@barlus/spectre";
import {Menu}               from "@barlus/spectre";
import {Tile}               from "@barlus/spectre";
import {TileContent}        from "@barlus/spectre";
import {TileIcon}           from "@barlus/spectre";
import {Avatar}             from "@barlus/spectre";
import {MenuBadge}          from "@barlus/spectre";
import {Table}              from "@barlus/spectre";
import {TableBody}          from "@barlus/spectre";
import {TableRow}           from "@barlus/spectre";
import {TableHeading}       from "@barlus/spectre";
import {TableCell}          from "@barlus/spectre";
import {MenuItem}           from "@barlus/spectre";
import {classes}            from "@barlus/spectre/utils/classes";
import {style}              from "@barlus/styles";
import {Theme}              from "@barlus/spectre/offCanvas/theme";
import {Theme as ThemeMenu} from "@barlus/spectre/menus/theme";
import {Session}            from "./Session";
import {SessionProps}       from "../types";
import "@barlus/spectre/styles";
import "@barlus/spectre/icons";

export class App extends React.Component {
    state = {
        user: {} as {username:string},
        sessions: [] as SessionProps[],
        session : null as SessionProps
    };
    async componentDidMount() {
        const evtSource = new EventSource("/api/events/session", { withCredentials: true } );
        evtSource.onmessage = ({data})=> {
          try {
              if(!data)return;
              const sessions = JSON.parse(data);
              const session = sessions.find(s=>s.id === Object(this.state.session).id)||sessions[0]||null;
              this.setState({sessions,session});
          }catch (e) {
              console.error(e)
          }
        };
        evtSource.onerror = function (err) {
            console.error(err)
        };
        evtSource.addEventListener('user',({data}:MessageEvent)=>{
            try {
                if(!data)return;
                const user = JSON.parse(data);
                this.setState({user});
            }catch (e) {
                console.error(e)
            }
        })
    }

    render() {
        const {session,sessions,user:{username}} = this.state;
        return (
            <div className={classes(Theme.offCanvas, Theme.active)}>
                <OffCanvasSidebar>
                    <Menu className={ThemeMenu.menuNav}>
                        <MenuItem style={{marginBottom: 20}}>
                            <Tile centered>
                                <TileIcon>
                                    <Avatar src={`https://api.adorable.io/avatars/40/${username}.png`}/>
                                </TileIcon>
                                <TileContent>
                                    {username}
                                </TileContent>
                            </Tile>
                        </MenuItem>
                        {session &&
                        <MenuItem>
                            <Table>
                                <TableBody>
                                    <TableRow>
                                        <TableHeading>DI</TableHeading>
                                        <TableCell>{session.id}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableHeading>DOMAIN</TableHeading>
                                        <TableCell>{session.domain}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableHeading>URL</TableHeading>
                                        <TableCell><a href={session.url} target="_blank">{session.url}</a></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableHeading>MAX SOCKETS</TableHeading>
                                        <TableCell>{session.maxSockets}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableHeading>SOCKETS COUNT</TableHeading>
                                        <TableCell>{session.socketsCount}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableHeading>USER</TableHeading>
                                        <TableCell>{session.user}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </MenuItem>
                        }
                        {sessions.map(session => {
                            return (
                                <MenuItem key={session.id}>
                                    <MenuBadge>
                                        <label className={style({
                                            borderRadius: ".1rem",
                                            display: "inline-block",
                                            lineHeight: 1.2,
                                            padding: ".1rem .2rem",
                                            backgroundColor: {
                                                online: '#32b643',
                                                offline: '#ffb700'
                                            }[session.status],
                                            color: "#fff"
                                        })}>{session.status}</label>
                                    </MenuBadge>
                                    <a
                                        className={classes({[Theme.active]:Object(this.state.session).id === session.id})}
                                        onClick={()=>this.setState({session})} href="javascript:;"><strong>{session.id}</strong>
                                    </a>
                                </MenuItem>
                            )
                        })}
                    </Menu>
                </OffCanvasSidebar>
                <OffCanvasContent className={style({transform:"translateX(17em)!important"})}>
                    <div className={style({
                        flex: "1 1 auto",
                        width: "calc(100vw - 12rem)"
                    })}>
                    {session && session.status === "online" &&
                    <Session key={session.id} {...session} />
                    }
                    </div>
                </OffCanvasContent>
            </div>
        )
    }
}

