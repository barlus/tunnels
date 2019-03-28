import {Buffer}     from '@barlus/bone/node/buffer';
import {process}    from '@barlus/bone/node/process';
import {colors}     from '@barlus/bone/utils/colors';
import {injectable} from '@barlus/runtime/inject/decorators';
import {singleton}  from '@barlus/runtime/inject/decorators';


@singleton
@injectable
export class Config {
  public readonly tunnel: string = null;
  public readonly domain: string;
  public readonly users: { [ s: string ]: string };
  public readonly cert: Buffer;
  public readonly key: Buffer;
  public readonly port: number = 443;
  public readonly address: string = '0.0.0.0';
  public get env() {
    return process.env.NODE_ENV || 'dev';
  }
  public async load() {
    function patch(target, source, path = 'config') {
      Object.keys(source).forEach(key => {
        const oldValue = target[ key ];
        const newValue = source[ key ];
        if (!Array.isArray(newValue)
          && typeof newValue == 'object'
          && typeof oldValue == 'object') {
          patch(oldValue, newValue, `${path}.${key}`)
        } else {
          if (oldValue !== newValue) {
            console.info(
              `${path}.${colors.yellow(key)}`,
              oldValue, colors.green(`${newValue}`)
            );
            target[ key ] = source[ key ];
          } else {
            console.info(
              `${path}.${colors.green(key)}`,
              oldValue
            );
          }
        }
      })
    }
    console.info("ENVIRONMENT", colors.blue(this.env));
    patch(this, await import(`./config.${this.env}`));
    return this;
  }
}

