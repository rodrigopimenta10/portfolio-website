// Links that leave the site open in a new tab, so the portfolio stays open in the one the visitor
// came from. "Leaves the site" means another host (a live project, GitHub, LinkedIn, the booking
// page) or a PDF, which the browser shows in its own viewer instead of a page of this site.
//
// It is done once, on the finished HTML of every page (src/middleware.ts), rather than by hand on
// each link: a link added next month, in a component or in a project's Markdown, gets the same
// treatment without anyone remembering to ask for it.

const ANCHOR = /<a\b[^>]*>/g;
const HREF = /\shref="([^"]*)"/;
const REL = /\srel="([^"]*)"/;

/** True when following `href` takes the visitor off the pages of `siteUrl`. */
export function leavesTheSite(href: string, siteUrl: string): boolean {
  if (/^https?:\/\//i.test(href)) {
    try {
      if (new URL(href).host !== new URL(siteUrl).host) return true;
    } catch {
      return false;
    }
  }
  // The resume PDF is on this host, but it is a document, not a page: it replaces the site in the tab.
  return /\.pdf(?:[?#].*)?$/i.test(href);
}

/** Adds target="_blank" and rel="noopener" to every anchor in `html` that leaves the site. */
export function openOutsideLinksInNewTab(html: string, siteUrl: string): string {
  return html.replace(ANCHOR, (tag) => {
    const href = HREF.exec(tag)?.[1];
    if (href === undefined || !leavesTheSite(href, siteUrl) || /\starget=/.test(tag)) return tag;

    // noopener: the page that opens cannot reach back into this one through window.opener.
    // An existing rel (the footer's rel="me") keeps its value and gains the new one.
    const rel = REL.exec(tag)?.[1];
    const withRel =
      rel === undefined
        ? tag.replace(/>$/, ' rel="noopener">')
        : /\bnoopener\b/.test(rel)
          ? tag
          : tag.replace(REL, ` rel="${rel} noopener"`);
    return withRel.replace(/>$/, ' target="_blank">');
  });
}
