import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const env = { ...process.env, COREPACK_HOME: path.join(root, '.cache/corepack'), COREPACK_DEFAULT_TO_LATEST: '0', TMPDIR: path.join(root, '.cache/tmp'), XDG_CACHE_HOME: path.join(root, '.cache/xdg-cache'), XDG_DATA_HOME: path.join(root, '.cache/xdg-data'), XDG_STATE_HOME: path.join(root, '.cache/xdg-state'), npm_config_cache: path.join(root, '.cache/npm'), PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.cache/browsers'), PWTEST_DAEMON_SESSION_DIR: path.join(root, '.cache/playwright-daemon'), DSH_HOME: path.join(root, '.runtime/dsh-home') };
env.PWTEST_SOCKETS_DIR = path.join(root, '.s');
env.DSH_SPACE_TEST_ROOT = path.join(root, '.runtime/fixtures');
// pnpm passes project config to child scripts; absolute paths keep nested profile installs in the same cache.
env.npm_config_store_dir = path.join(root, '.cache/pnpm-store');
env.npm_config_cache_dir = path.join(root, '.cache/pnpm-cache');
env.npm_config_state_dir = path.join(root, '.cache/pnpm-state');
for (const key of ['TMPDIR', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'npm_config_cache', 'PLAYWRIGHT_BROWSERS_PATH', 'PWTEST_SOCKETS_DIR', 'DSH_HOME']) mkdirSync(env[key], { recursive: true });
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error('Pass a command to run inside the project environment.');
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
