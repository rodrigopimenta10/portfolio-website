// Prints the Lighthouse scores of the last `lhci autorun` as a small Markdown table (the median
// run of those collected), for the CI job summary and for reading locally.
import { readFile } from 'node:fs/promises';

let manifest;
try {
  manifest = JSON.parse(await readFile('.lighthouseci/manifest.json', 'utf8'));
} catch {
  console.log('No Lighthouse results found (.lighthouseci/manifest.json).');
  process.exit(0);
}
const pct = (score) => Math.round(score * 100);
console.log('### Lighthouse (floor: 95)\n');
console.log('| Page | Performance | Accessibility | Best practices | SEO | Runs |');
console.log('|---|---|---|---|---|---|');
for (const run of manifest.filter((entry) => entry.isRepresentativeRun)) {
  const runs = manifest.filter((entry) => entry.url === run.url).length;
  const s = run.summary;
  console.log(`| ${new URL(run.url).pathname} | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s['best-practices'])} | ${pct(s.seo)} | ${runs} |`);
}
