import { readFile } from 'node:fs/promises';
import { root } from './run.mjs';
export async function authenticatedFetch() {
  const log = await readFile(`${root}/.runtime/dsh-server.log`, 'utf8');
  const url = log.match(/http:\/\/127\.0\.0\.1:39393\/\?token=[^\s]+/)?.[0];
  if (!url) throw new Error('Start the isolated DSH fixture before integration tests.');
  const response = await fetch(url, { redirect: 'manual' });
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  if (!cookie) throw new Error('DSH browser authentication did not issue a session cookie.');
  return (url, init = {}) => fetch(url, { ...init, headers: { ...init.headers, Cookie: cookie } });
}
