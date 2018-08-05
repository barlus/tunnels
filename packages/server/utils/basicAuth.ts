import {Buffer}     from "@barlus/bone/node/buffer";

export function decode(auth:string) {
    return Buffer.from(auth.split(' ')[1], 'base64')
        .toString()
        .split(':');
}