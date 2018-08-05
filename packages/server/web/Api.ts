import {Buffer}     from '@barlus/bone/node/buffer';
import {Https}      from '@barlus/bone/node/https';
import {URL}        from '@barlus/bone/node/url';
import {injectable} from '@barlus/runtime/inject/decorators';
import {singleton}  from '@barlus/runtime/inject/decorators';
import {Config}     from './Config';

@singleton
@injectable
export class Api {
  async get(path:string) {
    const url = new URL(`${this.config.tunnel}${path}`);
    return new Promise<{ status: number, headers: any, body: string }>((accept, reject) => {
      const req = Https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', (data) => {
          if (data) {
            chunks.push(data)
          }
          try {
            accept(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });

  }
  readonly config:Config;
  constructor(config:Config){
    this.config = config;
  }
}

