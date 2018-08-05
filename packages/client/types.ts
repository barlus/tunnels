export interface SessionProps {
    id: string,
    url: string,
    port: number,
    domain: string,
    maxSockets: number,
    socketsCount: number,
    status: 'online' | 'offline'
}

export interface RequestHeaders {
    "content-type": string;
    "cache-control": string;
    "user-agent": string;
    accept: string;
    host: string;
    "accept-encoding": string;
    "content-length": string;
    connection: string;

    [k: string]: string
}

export interface Request {
    method: string;
    path: string;
    url: string;
    headers: RequestHeaders;
    body: string;
}

export interface ResponseHeaders {
    host: string;
    connection: string;
    "cache-control": string;
    pragma: string;
    expires: string;
    date: string;
    "content-type": string;

    [k: string]: string
}

export interface Response {
    status: number;
    message: string;
    headers: ResponseHeaders;
    body: string;
}

export interface Context {
    id:string;
    duration: number;
    request: Request;
    response: Response;
}

export interface JsonInspectorProps {
    name?: string,
    data: object,
    initialExpandedPaths?: any[],
    depth?: number
    path?: string;
    setExpanded?;
    getExpanded?;
}