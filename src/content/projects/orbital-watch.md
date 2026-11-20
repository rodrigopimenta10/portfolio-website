---
kind: personal
title: Orbital Watch
order: 3
summary: Satellite passes over a ground station next to live space weather, on a static page that reports how fresh its own data is.
role: My own project, built with Claude Code. Its design decisions, and the failures that forced them, are written up in the repository's DECISIONS.md.
stack:
  - Python
  - Cloud Run job on Cloud Scheduler
  - Cloud Storage
  - Firebase Hosting
  - Terraform
  - GitHub Actions
  - pytest
result: Each of the seven upstream sources is marked fresh, stale or failed on the page, with the reason. A run with every source unreachable still publishes and says so, and CI checks that on every push.
live: https://orbital.rodrigopimenta.com
code: https://github.com/rodrigopimenta10/orbital-watch
statusId: orbital-watch
screenshot:
  src: ../../assets/screens/orbital-watch.webp
  alt: The Orbital Watch dashboard. A header marked FRESH with the build time, an operational assessment reading geomagnetic conditions nominal, five space-weather tiles and a chart of recent planetary Kp values.
  caption: orbital.rodrigopimenta.com on 19 November 2026 (UTC). Taken with headless Chrome at 1440 by 900, at twice the pixel density.
diagram:
  name: orbital-watch
  caption: One scheduled job fetches what is due, computes, judges its own sources and publishes one document. The browser reads that document and never calls an upstream API, so an upstream outage cannot take the page down.
  sourceHref: https://github.com/rodrigopimenta10/orbital-watch#architecture
  sourceLabel: README, "Architecture"
facts:
  - Seven sources, each marked fresh, stale or failed
  - A run with every source down still publishes and says so
  - One job every 10 minutes, its state in Cloud Storage
  - Built with Claude Code
sources:
  - claim: Each of the seven upstream sources is marked fresh, stale or failed on the page, with the reason; a run with every source unreachable still publishes and says so; CI checks that on every push.
    where: The repository README, "Reliability behaviour"; the workflow ci.yml runs the job with every socket refused.
    href: https://github.com/rodrigopimenta10/orbital-watch#reliability-behaviour
  - claim: A Cloud Run job started by Cloud Scheduler every 10 minutes, state in Cloud Storage, the page on Firebase Hosting, all of it in Terraform, deployed by GitHub Actions.
    where: The repository README, "Architecture", and its infra/ folder.
    href: https://github.com/rodrigopimenta10/orbital-watch/tree/main/infra
  - claim: The page's health panel comes from the one document the job publishes.
    where: The live document, read on 20 November 2026.
    href: https://storage.googleapis.com/portfolio-prod-0p1ht-orbital-watch-public/latest.json
---

## The idea

A monitoring system must report its own degradation as honestly as it reports its data. Every
number on the page carries its source and age. Every upstream source is classified fresh, stale
or failed against published thresholds, and no fallback is ever allowed to claim freshness it
does not have.

The orbital mechanics are not the interesting part. What happens when things break is.

## How it works

One job runs every ten minutes. It fetches what is due (space weather every run, satellite
element sets at most once every two hours per group, because that is how often their publisher
updates them), computes positions and passes, judges the health of every source, and publishes
one document. The page loads that document and renders. The browser never contacts an upstream
API.

The job remembers, in a storage bucket, what it last fetched and when it last asked. So an
upstream outage cannot empty the page: it keeps serving what it has, and the health panel says
that the data is stale and why. The document is written in one piece, so a reader never sees half
an update. And the page works out ages against the reader's own clock, so if the job stopped
publishing, the page would say so with no help from the job.

Every network call goes through one function. It has a hard limit on the whole download, catches
failure, records the outcome, and never raises, so no caller can stop a run by forgetting a `try`.

## Why it was rebuilt

The first version was a static site rebuilt every two hours, with its data refreshed by a GitHub
Actions schedule and committed to the repository. On 20 November 2026 the page reported its
satellite data as stale: 15 hours old against an 8-hour limit. The schedule was meant to run
twelve times a day and GitHub had been running it about three times. The page told the truth
about it, which is the point of the project, but the design depended on a scheduler that
promises nothing.

The rebuild keeps the orbit maths and the health rules and replaces the rest: one job with real
state, on a scheduler with a delivery guarantee, watched by alerts that do not depend on the job.
A review before the first deploy found six defects, among them a download timeout that limited
each read and not the whole download. Each was fixed with a test that failed first. The
repository's DECISIONS.md has the full account.

## Why it is on this site twice

The status panel on the home page follows the same rule. Its service reads the document this
project publishes, and when a check fails the panel says "could not check" and gives the reason. It does not guess.
