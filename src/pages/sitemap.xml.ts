// A sitemap small enough to write by hand: the fixed pages plus one per side project.
import type { APIRoute } from 'astro';
import { site } from '../data/site';
import { allProjects } from '../lib/projects';

export const GET: APIRoute = async () => {
  const projects = await allProjects();
  const paths = [
    '/',
    '/on-call',
    '/tools',
    '/self-healing',
    '/self-healing/storage',
    '/self-healing/config-drift',
    '/projects',
    ...projects.map((project) => `/projects/${project.id}`),
    '/how-this-site-runs',
  ];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site.url).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
