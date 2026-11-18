import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matches } from '../../scripts/firebase-glob.mjs';

const hosting = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8')).hosting;

function header(pathname: string, key: string): string | undefined {
  let value: string | undefined;
  for (const rule of hosting.headers) {
    if (matches(rule.source, pathname)) for (const h of rule.headers) if (h.key === key) value = h.value;
  }
  return value;
}

describe('the glob matcher', () => {
  it.each([
    ['**', '/anything/at/all', true],
    ['/', '/', true],
    ['/', '/projects', false],
    ['/projects/**', '/projects/sightline', true],
    ['/projects/**', '/projects', false],
    ['/@(projects|resume)', '/resume', true],
    ['/@(projects|resume)', '/resume/extra', false],
    ['/@(projects|404.html)', '/404xhtml', false],
    ['/api/**', '/api/status', true],
    ['/api/**', '/apix/status', false],
    ['/_astro/**', '/_astro/index.abc123.css', true],
  ])('%s against %s is %s', (source, pathname, expected) => {
    expect(matches(source, pathname)).toBe(expected);
  });
});

describe('firebase.json', () => {
  it('passes /api/** to the Cloud Run service portfolio-status in us-east4', () => {
    expect(hosting.rewrites).toEqual([{ source: '/api/**', run: { serviceId: 'portfolio-status', region: 'us-east4' } }]);
  });

  it('serves clean URLs with no trailing slash', () => {
    expect(hosting.cleanUrls).toBe(true);
    expect(hosting.trailingSlash).toBe(false);
  });

  it('caches pages briefly and fingerprinted assets for a year', () => {
    for (const page of ['/', '/projects', '/projects/sightline', '/experience', '/how-this-site-runs', '/resume', '/404.html']) {
      expect(header(page, 'Cache-Control'), page).toBe('public, max-age=300');
    }
    expect(header('/_astro/index.abc123.css', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('sets no cache rule on /api, so the status service decides how long its answer may be held', () => {
    expect(header('/api/status', 'Cache-Control')).toBeUndefined();
    expect(header('/api/healthz', 'Cache-Control')).toBeUndefined();
  });

  it('serves the resume as a PDF at its old address', () => {
    expect(header('/rodrigo_pimenta_resume.pdf', 'Content-Type')).toBe('application/pdf');
  });

  it('sends the security headers on every path', () => {
    for (const pathname of ['/', '/api/status', '/_astro/x.js', '/rodrigo_pimenta_resume.pdf']) {
      expect(header(pathname, 'X-Content-Type-Options')).toBe('nosniff');
      expect(header(pathname, 'X-Frame-Options')).toBe('DENY');
    }
  });
});
