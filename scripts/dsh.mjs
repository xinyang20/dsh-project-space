import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { root, env } from './run.mjs';
const manifest = JSON.parse(await readFile(`${root}/node_modules/@deepseek-ai/dsh/package.json`, 'utf8'));
if (manifest.version !== '0.2.0-rc.2') throw new Error('The local DSH runtime must be 0.2.0-rc.2.');
// Invoke the pinned local binary directly so a missing dependency cannot fall back to a global CLI.
const child = spawn(process.execPath, [`${root}/node_modules/@deepseek-ai/dsh/${manifest.bin.dsh}`, ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
