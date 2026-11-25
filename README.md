# rodrigopimenta.com

Rodrigo Pimenta's portfolio: a static Astro site, and one small Python service behind the status
panel on its Side projects page.

The four tabs read as one story, in order: **On call** (one incident, minute by minute),
**Tools** (the scripts and dashboard written to answer those calls faster), **Self-healing** (the
automation that made the calls stop, with two simulations to play with) and **Side projects**
(what is built outside work, with a live status panel).

**Status (18 November 2026):** live at [rodrigopimenta.com](https://rodrigopimenta.com), served by
Firebase Hosting in the Google Cloud project that the Terraform in `infra/` describes. Every merge to `main`
deploys. The domain is registered and its DNS is held at Cloudflare (DNS only, not proxied); nothing
else of this site runs there.

## What is here

```
src/
  pages/              Home, On call, Tools, Self-healing (and its two detail pages), Side projects,
                      one page per side project, How this site runs, 404
  content/projects/   one Markdown file per side project (add a file to add a project)
  data/resume.json    the resume as data, imported from its LaTeX source
  components/         StatusPanel, StatusLine, StorageSim, DriftSim, Onward, the diagrams
  lib/                logic with no DOM: status client and wording, the two simulation engines,
                      the Tools page's walkthroughs and dashboard
  scripts/            the small browser scripts (status panel and line, the simulations, Tools)
  styles/global.css   design tokens, base styles and the patterns the story pages share, hand-written
status/               the status service: Python 3.12, FastAPI, httpx (its own README section below)
legacy/               the page for the old GitHub Pages address
scripts/              local server, screenshots, resume import, output check
tests/unit/           Vitest: both simulation engines, Tools logic, status wording, resume import, firebase.json
tests/e2e/            Playwright: every page, the panel in each state, both simulations
firebase.json         hosting rules, and redirects for the addresses of pages that are gone
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
npx playwright install firefox webkit  # once
PW_CHANNEL=chrome npm run test:e2e     # browser tests: Chrome at two sizes, Firefox, Safari's engine
```

The browser tests start the status service on recorded responses
(`status/tests/fixtures/scenarios/all-up`) and the built site in front of it. No test reaches
the network. To measure Lighthouse the way CI does, serve the site (`npm run preview` with the
service running) and run `npm run lighthouse`.

`node scripts/screens.mjs` retakes the screenshots in `docs/screens/`.

## Dependencies, and why each is here

Runtime (what ships to visitors): **none**. The pages are HTML and CSS. The home page loads
about 2 kB of compressed JavaScript (the theme toggle, the status line and a loader), and about
4 kB more for the simulation when it scrolls into view. No page loads more than about 8 kB. No UI
framework: the interactive pieces are plain TypeScript.

| Package | Why |
|---|---|
| `astro` | Builds the pages, content collections, image resizing, and the per-page Content-Security-Policy hashes. The only non-dev dependency. |
| `typescript`, `@astrojs/check` | Type checking (`astro check`). TypeScript is pinned to 6.x because `@astrojs/check` 0.9 does not accept 7 yet. |
| `vitest` | Unit tests. |
| `@playwright/test` | Browser smoke tests, and the screenshot scripts. |
| `@lhci/cli` | Runs Lighthouse three times and fails under the floor of 95. |

The status service: `fastapi` (the two routes and the response schema), `httpx` (async outbound
calls, and a transport the tests replace), `uvicorn` (the server). Dev: `pytest`, `ruff`.

Fonts are self-hosted, latin subset, both under the SIL Open Font License 1.1: Geist
(Vercel) and IBM Plex Mono (IBM). The licence texts are in `src/assets/fonts/` and
published at `/licenses/`. Text is never blocked on them (`font-display: swap`).

## Add a project

Add `src/content/projects/<name>.md`. The frontmatter schema is in `src/content.config.ts` and a
build fails on a missing field. The body needs one `<!-- architecture -->` line where the
architecture figure goes. This collection holds side projects only: the work at Hughes is written
by hand in `src/pages/on-call.astro`, `tools.astro` and `self-healing/`.

Screenshots of live sites: `node scripts/capture-project-screens.mjs out/`, then
`cwebp -q 86 -m 6 out/<name>.png -o src/assets/screens/<name>.webp`.

## Update the resume

The resume's source is LaTeX in a separate repository. Two things come from it:

- `public/rodrigo_pimenta_resume.pdf`: copy the built PDF over it. Never rename it; the path is
  in messages already sent.
- `src/data/resume.json`: `npm run resume:import -- ../resume/rodrigo_pimenta_resume.tex`. Contact
  details come from this file, and the home page checks its numbers against it at build time
  (`resumeLine`), so the site cannot disagree with the resume. The importer stops on LaTeX it
  does not recognise.

There is no resume page: `/resume` and `/experience` redirect to the PDF.

## What may be said about work

The code written at Hughes is the employer's and none of it is here. The work pages describe what
it does in his own words, and both simulations run on made-up clusters, racks and numbers. Names
of satellites, sites and beams are made up (AURORA-2, northgate, beam 42), and so are the script
names. No cost of any cloud service is shown anywhere on the site.

## The status service (`status/`)

`GET /api/status` returns one row per system; `GET /api/healthz` returns `{"ok": true}`.

| Row | Source | Kept for |
|---|---|---|
| Sightline | `https://lunarsightline.com/api/status` (`revision`, `region`, Redis state) | 60 s |
| Orbital Watch | `latest.json` in its public Cloud Storage bucket, the document its own page reads | 60 s |
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
- `.github/workflows/infra.yml` (pull requests that touch `infra/`): `terraform fmt`, `validate`
  and `test` against mocked providers. Nothing signs in to Google Cloud.
- The Terraform is in `infra/` (its own README has what it creates, the costs and the bootstrap
  steps). It is applied by hand, not by a workflow. Changes under `infra/` alone do not run the
  site checks or a deploy.

## How it went live

Kept as a record, in the order it was done on 18 November 2026.

1. The Terraform now in `infra/` was applied (its README has the bootstrap steps). It lived in a
   separate repository then.
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

