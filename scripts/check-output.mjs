// Looks through the built output for things that must never be published: email addresses other
// than the public one, anything shaped like a credential, and any extra terms given at run time.
//
//   node scripts/check-output.mjs
//   FORBIDDEN_TERMS="term one,term two" node scripts/check-output.mjs   (names that must not appear;
//   kept out of this file because writing them here would publish them)
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_EMAIL = 'rodrigopimenta102@gmail.com';
const TEXT = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.map']);

const credentialShapes = [
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, 'a GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key ID'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\bsk-[A-Za-z0-9_-]{24,}/, 'an API secret key'],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/"private_key"\s*:/, 'a service account key'],
  [/\b[0-9]+-[0-9a-z]{32}\.apps\.googleusercontent\.com\b/, 'an OAuth client ID'],
];
const extraTerms = (process.env.FORBIDDEN_TERMS ?? '')
  .split(',')
  .map((term) => term.trim().toLowerCase())
  .filter(Boolean);

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (TEXT.has(path.extname(entry.name))) yield full;
  }
}

const problems = [];
let checked = 0;
for (const directory of ['dist', 'dist-legacy']) {
  for await (const file of files(path.join(root, directory))) {
    checked++;
    const text = await readFile(file, 'utf8');
    const name = path.relative(root, file);
    for (const match of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
      const email = match[0].toLowerCase();
      // "name@2x.png"-style asset names and npm scopes are not addresses.
      if (email !== PUBLIC_EMAIL && !/\.(png|jpg|webp|svg|js|css)$/.test(email)) problems.push(`${name}: email address ${match[0]}`);
    }
    for (const [shape, what] of credentialShapes) {
      if (shape.test(text)) problems.push(`${name}: looks like ${what}`);
    }
    const lower = text.toLowerCase();
    for (const term of extraTerms) {
      if (lower.includes(term)) problems.push(`${name}: contains a forbidden term (${term.length} characters)`);
    }
  }
}

if (checked === 0) {
  console.error('nothing to check: build first (npm run build)');
  process.exit(2);
}
if (problems.length) {
  console.error(`found in the build:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`${checked} built files checked: one email address (the public one), nothing shaped like a credential${extraTerms.length ? `, none of ${extraTerms.length} extra terms` : ''}`);
