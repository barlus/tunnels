import {Fs}  from '@barlus/bone/node/fs';
import {Path}  from '@barlus/bone/node/path';
import {HttpStatus}  from '@barlus/bone/http';
import {Handler}     from '@barlus/bone/http/application';
import {Context}     from '@barlus/bone/http/context';


export class WebHandler implements Handler {
  private options;
  private map={
    '.js':'application/javascript; charset=utf-8',
    '.html':'text/html; charset=utf-8',
  };
  constructor(options:{root}) {
    this.options = options;
  }
  async handle(cnx: Context, next: () => Promise<any>) {
    let path = Path.resolve(this.options.root,`./${cnx.request.url.pathname}`);
    if(!path.startsWith(this.options.root) || !Fs.existsSync(path) || !Fs.statSync(path).isFile()){
      path = Path.resolve(this.options.root,'index.html');
    }
    if(!Fs.existsSync(path)){
      return next();
    }else{
      const ext = Path.extname(path);
      const type = this.map[ext]||'text/plain; charset=utf-8';
      const body = Fs.readFileSync(path);
      cnx.response.setStatus(200,'OK');
      cnx.response.headers.set('Content-Type',type);
      cnx.response.setBody(body);
      return;
    }
  }
}