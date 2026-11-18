// Builds dist-legacy/: the few files that keep the old GitHub Pages address working.
//
// Resumes already sent carry rodrigopimenta10.github.io/portfolio-website/ in their header, so
// that address must keep answering. It gets a page that sends visitors to rodrigopimenta.com
// (a canonical link, a meta refresh, a visible link and a script), the resume PDF at the same
// path as before, and the privacy page that was published there.
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-legacy');

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'privacy'), { recursive: true });
await copyFile(path.join(root, 'legacy', 'index.html'), path.join(out, 'index.html'));
// GitHub Pages serves 404.html for any other path under the old address: send those home too.
await copyFile(path.join(root, 'legacy', 'index.html'), path.join(out, '404.html'));
await copyFile(path.join(root, 'public', 'rodrigo_pimenta_resume.pdf'), path.join(out, 'rodrigo_pimenta_resume.pdf'));
await copyFile(path.join(root, 'public', 'privacy', 'index.html'), path.join(out, 'privacy', 'index.html'));
await copyFile(path.join(root, 'public', 'favicon.svg'), path.join(out, 'favicon.svg'));
console.log('built dist-legacy/ (index.html, 404.html, rodrigo_pimenta_resume.pdf, privacy/, favicon.svg)');
