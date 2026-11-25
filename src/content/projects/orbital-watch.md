---
title: Orbital Watch
order: 2
summary: Satellite passes over a ground station next to live space weather, on a static page that reports how fresh its own data is.
role: My own project, built with Claude Code. Its design decisions, and the failures that forced them, are written up in the repository's DECISIONS.md.
result: Each of the seven upstream sources is marked fresh, stale or failed on the page, with the reason. A run with every source unreachable still publishes and says so, and CI checks that on every push.
stack:
  - Python
  - Cloud Run job on Cloud Scheduler
  - Cloud Storage
  - Firebase Hosting
  - Terraform
  - GitHub Actions
  - pytest
live: https://orbital.rodrigopimenta.com
code: https://github.com/rodrigopimenta10/orbital-watch
screenshot:
  src: ../../assets/screens/orbital-watch.webp
  alt: The Orbital Watch dashboard. A header marked FRESH, 7 of 7 sources fresh, with the time the data was published, an operational assessment reading geomagnetic conditions nominal, five space-weather tiles and a chart of recent planetary Kp values.
  caption: orbital.rodrigopimenta.com on 20 November 2026, the day it moved to Google Cloud.
architecture:
  caption: One scheduled job fetches, computes, judges its own sources and publishes one document.
  diagram: orbital-watch
card:
  summary: Satellite passes over a ground station next to live space weather, on a page that reports how fresh its own data is.
  alt: "Orbital Watch: a dashboard marked fresh, 7 of 7 sources fresh, with space weather tiles and a Kp chart"
  claim: Seven sources, each marked fresh, stale or failed.
  detail: A run with every source down still publishes and says so, and CI checks that on every push.
  tags:
    - Python
    - Cloud Run job
    - Cloud Scheduler
    - Cloud Storage
    - Terraform
---

## The idea

A monitoring system must report its own degradation as honestly as it reports its data. Every
number on the page carries its source and age, and every source is marked fresh, stale or failed
against published thresholds.

## How it works

One job runs every ten minutes. It fetches what is due, computes positions and passes, judges the
health of every source and publishes one document. The page loads that document, and the browser
never contacts an upstream API.

The job remembers what it last fetched, so an upstream outage cannot empty the page: it keeps
serving what it has and says the data is stale and why. The page works out ages against the
reader's own clock, so if the job stopped publishing, the page would say so by itself.

<!-- architecture -->

## Why it was rebuilt

The first version refreshed its data on a GitHub Actions schedule that was meant to run twelve
times a day and ran about three. On 20 November 2026 the page reported its own satellite data as
stale, which is the point of the project, but the design depended on a scheduler that promises
nothing. The rebuild runs one job with real state on a scheduler with a delivery guarantee,
watched by alerts that do not depend on the job.

## The same rule on this site

The status panel on the Side projects page reads the document this project publishes. When a
check fails it says "could not check" and gives the reason.
