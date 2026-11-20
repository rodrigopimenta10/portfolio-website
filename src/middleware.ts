// Runs once per page while the site is built (and on each request in `npm run dev`); the result
// is still plain HTML files. Its one job: links that leave the site open in a new tab.
import { defineMiddleware } from 'astro:middleware';
import { site } from './data/site';
import { openOutsideLinksInNewTab } from './lib/outside-links';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const html = await response.text();
  return new Response(openOutsideLinksInNewTab(html, site.url), {
    status: response.status,
    headers: response.headers,
  });
});
