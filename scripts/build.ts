import {Service}   from '@barlus/bone/compiler';
import {Path}      from '@barlus/bone/node/path';
import {process}   from '@barlus/bone/node/process';
import * as rollup from "rollup";
// see below for details on the options
const external = [
  'process',
  'events',
  'buffer',
  'stream',
  'http',
  'https',
  'url',
  'fs',
  'tls',
  'net',
  //'typescript'
];

async function bundle(format: 'cjs'|'iife', module: string, name = Path.basename(module), output = './dist',banner?) {
  const inputOptions = {
    input: `./.cache/${module}.js`,
    external(id) {
      return external.includes(id);
    }
  };
  const outputOptions = {
    banner,
    file: Path.resolve(output, `${name}.js`),
    format: format,
    name: name,
  };
  // create a bundle
  const bundle = await rollup.rollup(inputOptions);
  // generate code and a sourcemap
  await bundle.generate(outputOptions);
  // or write the bundle to disk
  await bundle.write(outputOptions);
  console.info(module,name,'->',outputOptions.file);
}
async function build() {
  Service.init({
    root: process.cwd(),
    ignore: [ 'typescript' ]
  });
  await bundle('cjs', '@barlus/tunnels-server/TunnelCli','cli','./dist','#!/usr/bin/env node');
  await bundle('cjs', '@barlus/tunnels-client/index','index','./dist/public');
  console.info("DONE");
  process.exit(0);
}

build().catch(console.error);