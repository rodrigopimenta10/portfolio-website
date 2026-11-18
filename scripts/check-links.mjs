// Opens every external link in the built site and reports the ones that do not work.
// Run by hand before a release (it needs the network, so it is not part of CI):
//
//   npm run build && node scripts/check-links.mjs
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const links = new Map();

async function* htmlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

for (const directory of ['dist', 'dist-legacy']) {
  for await (const file of htmlFiles(path.join(root, directory))) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      const url = match[1].replace(/&amp;/g, '&');
      if (!links.has(url)) links.set(url, new Set());
      links.get(url).add(path.relative(root, file));
    }
  }
}

async function check(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (link check before release)', Accept: 'text/html,*/*' },
    });
    await response.body?.cancel();
    return { status: response.status, final: response.url };
  } catch (error) {
    return { status: 0, error: String(error.cause?.code ?? error.message) };
  }
}

let failed = 0;
const results = await Promise.all([...links.keys()].sort().map(async (url) => [url, await check(url)]));
for (const [url, result] of results) {
  // LinkedIn answers 999 to anything that is not a signed-in browser; that is not a broken link.
  const blocked = result.status === 999 && url.includes('linkedin.com');
  const ok = (result.status >= 200 && result.status < 300) || blocked;
  if (!ok) failed++;
  const note = blocked ? ' (LinkedIn refuses automated requests)' : result.final && result.final !== url ? ` -> ${result.final}` : '';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${result.status || result.error}  ${url}${note}${ok ? '' : `   in ${[...links.get(url)].join(', ')}`}`);
}
console.log(`${links.size} external links, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
