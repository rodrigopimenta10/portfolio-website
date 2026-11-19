# rodrigopimenta.com

Rodrigo Pimenta's portfolio: a static Astro site, and one small Python service behind the status
panel on its home page.

**Status (18 November 2026):** live at [rodrigopimenta.com](https://rodrigopimenta.com), served by
Firebase Hosting in the Google Cloud project that `portfolio-infra` describes. Every merge to `main`
deploys. The domain is registered and its DNS is held at Cloudflare (DNS only, not proxied); nothing
else of this site runs there.

## What is here

```
src/
  pages/              Home, Projects, one page per project, Experience, How this site runs, Resume, 404
  content/projects/   one Markdown file per project (add a file to add a project)
  data/resume.json    the resume as data, imported from its LaTeX source
  components/         StatusPanel, FailoverSim, the diagrams (inline SVG)
  lib/                logic with no DOM: status client and wording, the failover engine
  scripts/            the two small browser scripts (status panel, failover UI)
  styles/global.css   design tokens and base styles, hand-written
status/               the status service: Python 3.12, FastAPI, httpx (its own README section below)
legacy/               the page for the old GitHub Pages address
scripts/              local server, screenshots, resume import, output check
tests/unit/           Vitest: engine, status wording, resume import, firebase.json
tests/e2e/            Playwright: every page, the panel in each state, the simulation
firebase.json         hosting rules
.github/workflows/    ci.yml, deploy.yml, pages-legacy.yml
docs/screens/         screenshots of every page, taken before this branch was handed over
```

## Run it

Needs Node 26 (`.nvmrc`; Astro 7 needs at least 22.23.4) and [uv](https://docs.astral.sh/uv/).

```sh
npm ci
(cd status && uv sync)

# The status service on :8080 (live sources), and the site with hot reload on :4321
(cd status && uv run uvicorn portfolio_status.app:app --port 8080) &
npm run dev

# Or the built site, served the way firebase.json describes
npm run build
npm run preview          # http://127.0.0.1:4321, /api/* passed to :8080
```

Without the service running, the panel says it could not reach it. That is the designed
behaviour, not a bug.

## Check it

```sh
npm run check                          # astro check, TypeScript strictest
npm test                               # unit tests
(cd status && uv run ruff check . && uv run ruff format --check . && uv run pytest)
npm run build && node scripts/check-output.mjs
PW_CHANNEL=chrome npm run test:e2e     # browser smoke tests, using the installed Google Chrome
```

The browser tests start the status service on recorded responses
(`status/tests/fixtures/scenarios/all-up`) and the built site in front of it. No test reaches
the network. To measure Lighthouse the way CI does, serve the site (`npm run preview` with the
service running) and run `npm run lighthouse`.

`node scripts/screens.mjs` retakes the screenshots in `docs/screens/`.

## Dependencies, and why each is here

Runtime (what ships to visitors): **none**. The pages are HTML and CSS. The home page loads
about 3.5 kB of compressed JavaScript (the status panel, the theme toggle and a loader), and
about 3.3 kB more for the simulation when it scrolls into view. No UI framework: the two
interactive pieces are plain TypeScript.

| Package | Why |
|---|---|
| `astro` | Builds the pages, content collections, image resizing, and the per-page Content-Security-Policy hashes. The only non-dev dependency. |
| `typescript`, `@astrojs/check` | Type checking (`astro check`). TypeScript is pinned to 6.x because `@astrojs/check` 0.9 does not accept 7 yet. |
| `vitest` | Unit tests. |
| `@playwright/test` | Browser smoke tests, and the screenshot scripts. |
| `@lhci/cli` | Runs Lighthouse three times and fails under the floor of 95. |

The status service: `fastapi` (the two routes and the response schema), `httpx` (async outbound
calls, and a transport the tests replace), `uvicorn` (the server). Dev: `pytest`, `ruff`.

Fonts are self-hosted, latin subset, both under the SIL Open Font License 1.1: Newsreader
(Production Type) and IBM Plex Mono (IBM). The licence texts are in `src/assets/fonts/` and
published at `/licenses/`. Text is never blocked on them (`font-display: swap`).

## Add a project

Add `src/content/projects/<name>.md`. The frontmatter schema is in `src/content.config.ts` and a
build fails on a missing field. A project that is public (`kind: personal`) needs a summary, his
part, the stack, a result, a screenshot, a diagram and a list of where each claim was checked. A
system built at work (`kind: work`) has no text of its own: it names an entry in the resume and
the site shows the resume's words.

Screenshots of live sites: `node scripts/capture-project-screens.mjs out/`, then
`cwebp -q 86 -m 6 out/<name>.png -o src/assets/screens/<name>.webp`.

## Update the resume

The resume's source is LaTeX in a separate repository. Two things come from it:

- `public/rodrigo_pimenta_resume.pdf`: copy the built PDF over it. Never rename it; the path is
  in messages already sent.
- `src/data/resume.json`: `npm run resume:import -- ../resume/rodrigo_pimenta_resume.tex`. The
  Resume and Experience pages, and the two work systems, are rendered from this file, so the site
  cannot disagree with the resume. The importer stops on LaTeX it does not recognise.

Nothing internal to his employer may appear on the site. The work systems are described in the
resume's words only.

## The status service (`status/`)

`GET /api/status` returns one row per system; `GET /api/healthz` returns `{"ok": true}`.

| Row | Source | Kept for |
|---|---|---|
| Sightline | `https://lunarsightline.com/api/status` (`revision`, `region`, Redis state) | 60 s |
| Orbital Watch | `https://orbital.rodrigopimenta.com/data/health.json`, the file its own page reads | 60 s |
| AWS platform | GitHub's public API: runs of `live-drill.yml` in `aws-platform-terraform` triggered after CI, and the jobs of the latest one that really drilled | 5 min |
| This site | the service itself: its Cloud Run revision, region and start time | not kept |

- Sources are asked in parallel. Each call has 4 s (2 s to connect); each source 6 s in all.
- It never raises to the caller. A source that fails becomes `"state": "unknown"` (shown as
  "could not check") with the reason, and the last good answer if there was one. A failed check
  is retried after 20 s; a GitHub rate limit waits for its reset, 15 minutes at most.
- Under load, one request per source refreshes the cache and the rest wait for it.
- `Cache-Control: public, max-age=30, s-maxage=60`, or 15 s when a check in the answer failed.
- GitHub allows an anonymous address 60 calls an hour, which the 5-minute cache stays under.
  `GITHUB_TOKEN` is optional and raises that limit.
- `STATUS_RECORDED_DIR` makes it answer from files (tests and CI). The answer then carries
  `"recorded": true` and the panel says so.

Sightline's `revision` is shown as its endpoint returns it (for example `clps-web-00368-545`;
the service name is public in Sightline's repository).

## Hosting, written but not applied

- `firebase.json`: `/api/**` goes to the Cloud Run service `portfolio-status` in `us-east4`;
  clean URLs; a year of caching for `/_astro/**`; five minutes for pages; the PDF served as a PDF.
  `.firebaserc` names the project `portfolio-prod-0p1ht` and the Hosting site
  `rodrigopimenta-portfolio`.
- `.github/workflows/ci.yml` (pull requests): type check, unit tests, service lint and tests,
  container build, site build, output check, Playwright smoke test, Lighthouse floor.
- `.github/workflows/deploy.yml` (main, and a preview channel per pull request): Cloud Run then
  Firebase Hosting, through Workload Identity Federation, no keys. Every job is skipped until the
  repository variable `GCP_PROJECT_ID` exists.
- `.github/workflows/pages-legacy.yml` (main): publishes `dist-legacy/` to the old GitHub Pages
  address. It is the previous Pages workflow, renamed and cut down: instead of a copy of the site
  it publishes a page that sends visitors to rodrigopimenta.com, the resume PDF at the same path,
  and the privacy page.
- The Terraform is in a separate repository, `portfolio-infra`.

## How it went live

Kept as a record, in the order it was done on 18 November 2026.

1. The Terraform in `portfolio-infra` was applied (its README has the bootstrap steps).
2. The repository variables were set from its outputs: `GCP_PROJECT_ID`,
   `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `GCP_PREVIEW_SERVICE_ACCOUNT`,
   `FIREBASE_HOSTING_SITE`.
3. The previous site ran on Cloudflare Pages, which built every branch of this repository. A guard
   in the build made those builds fail on purpose, so Cloudflare kept serving the old site while
   this one was reviewed on its `web.app` address.
4. `rodrigopimenta.com` and `www` were added as custom domains on the Hosting site. Firebase's
   check records (TXT: ownership and the certificate challenge, for each name) went into the
   Cloudflare zone first, so the certificates were issued before any visitor was sent here.
5. The apex and `www` records became `A` records pointing at Firebase (DNS only, not proxied).
   The `orbital` record was left as it is.
6. The Cloudflare Pages project was stopped from building this repository and detached from the
   domain, and the build guard was removed.

