import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'frontend');
const out = resolve(root, 'dist');
const rawBackend = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');

if (!rawBackend) {
  console.error('Missing BACKEND_URL. Set it in Netlify to your deployed API URL, e.g. https://gabes-pokemon-creator-api.onrender.com');
  process.exit(1);
}
if (!/^https:\/\//i.test(rawBackend)) {
  console.error('BACKEND_URL must use https://');
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(source, out, { recursive: true });

const redirects = `/api/*  ${rawBackend}/api/:splat  200\n/*  /index.html  200\n`;
await writeFile(resolve(out, '_redirects'), redirects, 'utf8');
console.log(`Built Netlify site. /api/* will proxy to ${rawBackend}`);
