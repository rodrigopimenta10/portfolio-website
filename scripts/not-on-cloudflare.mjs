// Stops a build on Cloudflare Pages, on purpose.
//
// rodrigopimenta.com was served by a Cloudflare Pages project that builds this repository's main
// branch. This site is served from Firebase Hosting instead, where /api/** reaches the status
// service. A copy built on Cloudflare would have no status service behind it and would show a
// failed panel on the first screen. When a Pages build fails, Cloudflare keeps serving its last
// good deployment, so failing here leaves the previous site up until the domain's DNS is moved.
//
// Cloudflare Pages sets CF_PAGES=1 in its build environment. Delete this file, and its call in
// package.json, once the Pages project is gone.
if (process.env.CF_PAGES) {
  console.error('This site is built for Firebase Hosting and is not meant to build on Cloudflare Pages.');
  console.error('The previous Pages deployment stays live. See scripts/not-on-cloudflare.mjs.');
  process.exit(1);
}
