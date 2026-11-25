// Serves the built site the way firebase.json says Firebase Hosting will: clean URLs, the header
// rules, 404.html for unknown paths, and /api/** passed on to the status service. It exists so
// the smoke tests and Lighthouse run against something that behaves like production, without
// the Firebase emulator. It is a test tool and is never deployed.
//
//   node scripts/serve.mjs [--port 4321] [--api http://127.0.0.1:8080 | --api off] [--api-delay 3000]
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { matches } from './firebase-glob.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const port = Number(option('port', process.env.PORT ?? 4321));
const api = option('api', process.env.STATUS_ORIGIN ?? 'http://127.0.0.1:8080');
const apiDelay = Number(option('api-delay', 0));

const config = JSON.parse(await readFile(path.join(root, 'firebase.json'), 'utf8')).hosting;
const publicDir = path.join(root, config.public);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

/** The file a request path maps to under cleanUrls, or null. */
async function resolve(pathname) {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = path.join(publicDir, safe);
  if (!base.startsWith(publicDir)) return null;
  const candidates = pathname.endsWith('/') ? [path.join(base, 'index.html')] : [base, `${base}.html`, path.join(base, 'index.html')];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

function headersFor(pathname) {
  const headers = {};
  for (const rule of config.headers ?? []) {
    if (matches(rule.source, pathname)) for (const { key, value } of rule.headers) headers[key] = value;
  }
  return headers;
}

async function proxy(request, response, pathname) {
  if (apiDelay) await new Promise((done) => setTimeout(done, apiDelay));
  if (api === 'off') {
    response.writeHead(502, { 'Content-Type': 'text/plain' }).end('The status service is not running.');
    return;
  }
  try {
    const upstream = await fetch(new URL(pathname + (new URL(request.url, 'http://x').search ?? ''), api), {
      // The method goes with it, as Firebase Hosting's rewrite passes it: /api/hit is a POST.
      method: request.method,
      headers: { accept: request.headers.accept ?? '*/*' },
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const headers = { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' };
    const cache = upstream.headers.get('cache-control');
    if (cache) headers['Cache-Control'] = cache;
    response.writeHead(upstream.status, headers).end(body);
  } catch {
    response.writeHead(502, { 'Content-Type': 'text/plain' }).end('The status service did not answer.');
  }
}

const server = http.createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  // Redirects come first, as on Firebase Hosting: an old address answers with the new one.
  const redirect = (config.redirects ?? []).find((rule) => matches(rule.source, pathname));
  if (redirect) {
    response.writeHead(redirect.type ?? 301, { Location: redirect.destination }).end();
    return;
  }
  if ((config.rewrites ?? []).some((rewrite) => rewrite.run && matches(rewrite.source, pathname))) {
    return proxy(request, response, pathname);
  }
  // cleanUrls: /page.html redirects to /page.
  if (config.cleanUrls && pathname.endsWith('.html') && pathname !== '/404.html') {
    response.writeHead(301, { Location: pathname.replace(/(\/index)?\.html$/, '') || '/' }).end();
    return;
  }
  let status = 200;
  let file = await resolve(pathname);
  if (!file) {
    status = 404;
    file = path.join(publicDir, '404.html');
    if (!(await isFile(file))) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
  }
  const extension = path.extname(file);
  const headers = {
    'Content-Type': TYPES[extension] ?? 'application/octet-stream',
    // Firebase Hosting's default for static files when no rule says otherwise.
    'Cache-Control': 'public, max-age=3600',
    ...headersFor(pathname),
  };
  const accepts = request.headers['accept-encoding'] ?? '';
  if (COMPRESSIBLE.has(extension) && /\bbr\b/.test(accepts)) {
    const body = zlib.brotliCompressSync(await readFile(file));
    response.writeHead(status, { ...headers, 'Content-Encoding': 'br', Vary: 'Accept-Encoding' }).end(body);
    return;
  }
  response.writeHead(status, headers);
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${path.relative(root, publicDir)}/ at http://127.0.0.1:${port} (api: ${api}${apiDelay ? `, delayed ${apiDelay} ms` : ''})`);
});
