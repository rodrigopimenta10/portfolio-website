import { describe, expect, it } from 'vitest';
import { leavesTheSite, openOutsideLinksInNewTab } from '../../src/lib/outside-links';

const site = 'https://rodrigopimenta.com';
const mark = (html: string) => openOutsideLinksInNewTab(html, site);

describe('leavesTheSite', () => {
  it('is true for another host and for a PDF, false for pages of this site', () => {
    expect(leavesTheSite('https://lunarsightline.com', site)).toBe(true);
    expect(leavesTheSite('https://github.com/rodrigopimenta10/orbital-watch', site)).toBe(true);
    expect(leavesTheSite('/rodrigo_pimenta_resume.pdf', site)).toBe(true);
    expect(leavesTheSite('/projects/sightline', site)).toBe(false);
    expect(leavesTheSite('https://rodrigopimenta.com/experience', site)).toBe(false);
    expect(leavesTheSite('#main', site)).toBe(false);
    // Opening the mail program does not replace the page, so it needs no new tab.
    expect(leavesTheSite('mailto:someone@example.com', site)).toBe(false);
  });
});

describe('openOutsideLinksInNewTab', () => {
  it('opens a link to another site in a new tab, without access back to this page', () => {
    expect(mark('<a href="https://lunarsightline.com">Live site</a>')).toBe(
      '<a href="https://lunarsightline.com" rel="noopener" target="_blank">Live site</a>',
    );
  });

  it('opens the resume PDF in a new tab', () => {
    expect(mark('<a class="button" href="/rodrigo_pimenta_resume.pdf">Download the PDF</a>')).toContain('target="_blank"');
  });

  it('keeps a rel that is already there', () => {
    expect(mark('<a href="https://github.com/rodrigopimenta10" rel="me">GitHub</a>')).toBe(
      '<a href="https://github.com/rodrigopimenta10" rel="me noopener" target="_blank">GitHub</a>',
    );
  });

  it('leaves links within the site, mail links and anchors without an address alone', () => {
    const html = '<a href="/projects">Projects</a><a href="mailto:a@example.com">a</a><a id="top">top</a><a href="#main">skip</a>';
    expect(mark(html)).toBe(html);
  });

  it('does not touch a link that already says where it opens, and is safe to run twice', () => {
    const once = mark('<a href="https://example.com" target="_self">x</a><a href="https://example.com">y</a>');
    expect(once).toContain('target="_self"');
    expect(mark(once)).toBe(once);
  });
});
