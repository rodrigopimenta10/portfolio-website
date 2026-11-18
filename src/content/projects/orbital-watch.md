---
kind: personal
title: Orbital Watch
order: 3
summary: Satellite passes over a ground station next to live space weather, on a static site that reports how fresh its own data is.
role: My own project, built with Claude Code. Its design decisions, and the failures that forced them, are written up in the repository's DECISIONS.md.
stack:
  - Python build
  - Cloudflare Pages
  - A Cloudflare Worker on a schedule
  - GitHub Actions
  - pytest
result: Each of the seven upstream sources is marked fresh, stale or failed on the page, with the reason. A build with every source unreachable still finishes and says so, and CI checks that on every push.
live: https://orbital.rodrigopimenta.com
code: https://github.com/rodrigopimenta10/orbital-watch
statusId: orbital-watch
screenshot:
  src: ../../assets/screens/orbital-watch.webp
  alt: The Orbital Watch dashboard. A header marked FRESH with the build time, an operational assessment reading geomagnetic conditions nominal, five space-weather tiles and a chart of recent planetary Kp values.
  caption: orbital.rodrigopimenta.com on 18 November 2026. Taken with headless Chrome at 1440 by 900, at twice the pixel density.
diagram:
  name: orbital-watch
  caption: A scheduled build fetches, computes and judges its own sources, then writes static files. The browser never calls an upstream API, so an upstream outage cannot take the page down.
  sourceHref: https://github.com/rodrigopimenta10/orbital-watch#architecture
  sourceLabel: README, "Architecture"
facts:
  - Seven sources, each marked fresh, stale or failed
  - A build with every source down still finishes and says so
  - Static files on Cloudflare Pages
  - Built with Claude Code
sources:
  - claim: Each of the seven upstream sources is marked fresh, stale or failed on the page, with the reason; a build with every source unreachable still finishes and says so; CI checks that on every push.
    where: GitHub profile README; the repository README, "Reliability behaviour".
    href: https://github.com/rodrigopimenta10/orbital-watch#reliability-behaviour
  - claim: Python build, Cloudflare Pages, a Cloudflare Worker on a schedule, GitHub Actions, pytest. Built with Claude Code.
    where: GitHub profile README.
    href: https://github.com/rodrigopimenta10
  - claim: The page's health panel is written to data/health.json by each build.
    where: The live file, read on 18 November 2026 (seven sources, all fresh).
    href: https://orbital.rodrigopimenta.com/data/health.json
---

## The idea

A monitoring system must report its own degradation as honestly as it reports its data. Every
number on the page carries its source and age. Every upstream source is classified fresh, stale
or failed against published thresholds, and no fallback is ever allowed to claim freshness it
does not have.

The orbital mechanics are not the interesting part. What happens when things break is.

## How it works

A Python build fetches element sets and space weather, computes satellite positions and passes,
judges the health of every source, and writes JSON files into the build output. The page loads
those files and renders. The browser never contacts an upstream API.

That buys three things. An upstream outage cannot take the site down: the build falls back to a
cache or a committed snapshot, every panel still renders, and the health panel says the data is
stale and why. Hosting is static files on a CDN. And "last updated" is measured, not asserted,
because every fetch is recorded with its outcome and time.

Every network call goes through one function. It has a hard timeout, catches failure, records
the outcome, and never raises, so no caller can abort the build by forgetting a `try`.

## Why it is on this site twice

The status panel on the home page follows the same rule. Its service reads this project's own
health file, and when a check fails the panel says "could not check" and gives the reason. It does not guess.
