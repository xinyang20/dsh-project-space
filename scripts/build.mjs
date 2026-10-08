import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { root } from './run.mjs';

await mkdir(`${root}/lib`, { recursive: true });
await build({ entryPoints: [`${root}/src/index.ts`], outfile: `${root}/lib/index.js`, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: true });
const browser = await build({ entryPoints: [`${root}/src/client/index.tsx`], bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', external: ['react'], write: false, minify: false });
await writeFile(`${root}/lib/client.js`, `window.__ModuleLoader__.load({id:"dsh-project-space",factory:(require)=>{const module={exports:{}};const exports=module.exports;\n${browser.outputFiles[0].text}\nreturn module.exports;}});\n`);
console.log('Built DSH host module and ModuleLoader browser module.');
