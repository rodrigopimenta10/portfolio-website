// @ts-check
import { defineConfig } from 'astro/config';

// Static output only: every page is an HTML file on a CDN, and the one live piece of data
// (the status panel) is fetched by the browser from /api/status after the page paints.
export default defineConfig({
  site: 'https://rodrigopimenta.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    // /projects/sightline.html rather than /projects/sightline/index.html. Firebase Hosting's
    // cleanUrls then serves it at /projects/sightline, with no redirect to a trailing slash.
    format: 'file',
    // All CSS is a few kilobytes: put it in the page, so nothing blocks the first paint but the HTML.
    inlineStylesheets: 'always',
  },
  // Lossless whitespace removal, as before Astro 7 (the new default drops spaces between inline elements).
  compressHTML: true,
  security: {
    // Astro writes a <meta> Content-Security-Policy into each page with a hash for every script
    // and style it emits, so nothing inline needs 'unsafe-inline'.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'none'",
        "object-src 'none'",
      ],
    },
  },
  vite: {
    server: {
      // `npm run dev` with the status service on :8080 (see README).
      proxy: { '/api': 'http://127.0.0.1:8080' },
    },
  },
});
