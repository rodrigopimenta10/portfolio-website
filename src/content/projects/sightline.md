---
kind: personal
title: Sightline
order: 1
summary: A lunar landing-site planner. It shows when the Sun and Earth are in view from a landing site at the Moon's south pole, every hour from 2026 to 2049, and whether a landing date fits a mission's limits.
role: I led the six-person team behind it (NASA Space Apps 2026) and owned the architecture decisions. AI coding agents wrote most of the code, under my direction and review.
stack:
  - Python
  - TypeScript and React
  - Google Cloud Run
  - Terraform
  - Firestore
  - Redis
  - Pub/Sub and BigQuery
  - GitHub Actions
result: Sun and Earth positions match JPL Horizons within 0.0071° over 5,469,984 hourly checks. Deploys go out as a canary and roll back automatically. 2,020 tests run in CI.
live: https://lunarsightline.com
code: https://github.com/shackleton-station/sightline
statusId: sightline
screenshot:
  src: ../../assets/screens/sightline.webp
  alt: Sightline's front page. The Moon seen from above its south pole, half lit, with marked landing sites, a time bar set to 27 November 2026 and the Scout co-pilot open on the right.
  caption: lunarsightline.com on 18 November 2026, after closing the welcome card. Taken with headless Chrome at 1440 by 900, at twice the pixel density.
diagram:
  name: sightline
  caption: Four Cloud Run services behind one load balancer. No service calls another to answer a visitor; the load balancer sends each path to the service that owns it.
  sourceHref: https://github.com/shackleton-station/sightline/blob/main/docs/SYSTEM_DESIGN.md
  sourceLabel: docs/SYSTEM_DESIGN.md
facts:
  - Led a team of six
  - Four Cloud Run services, all in Terraform
  - 0.0071° from JPL Horizons over 5,469,984 checks
  - 2,020 tests in CI; canary deploys that roll back
sources:
  - claim: Led the six-person team, owned the architecture decisions, directed AI coding agents that wrote most of the code.
    where: Resume, Systems Built; the repository README names the team of six and its captain.
    href: https://github.com/shackleton-station/sightline#readme
  - claim: Matches JPL Horizons within 0.0071° over 5,469,984 hourly checks; 2,020 tests in CI; canary deploys with automatic rollback.
    where: Resume, Systems Built. The repository README carries the 5,469,984 figure.
    href: https://github.com/shackleton-station/sightline#readme
  - claim: Four Cloud Run services behind a load balancer, CDN and Cloud Armor; Firestore, Redis, Pub/Sub into BigQuery; Terraform applied from GitHub Actions with no stored keys.
    where: Resume and the repository's docs/SYSTEM_DESIGN.md.
    href: https://github.com/shackleton-station/sightline/blob/main/docs/SYSTEM_DESIGN.md
  - claim: 13 sites, every hour from 2026 to 2049; 1.04 trillion Sun and Earth answers computed.
    where: Repository README, "By the numbers".
    href: https://github.com/shackleton-station/sightline#readme
---

## What it does

A lander at the Moon's south pole needs the Sun for power and Earth for a direct radio link, and
there both only skim the horizon, so the hills decide when each is in view. Sightline computes
that from NASA's terrain and ephemeris data for 13 sites, every hour from 2026 to 2049.

You pick a site, a landing date and a mission: how long it lasts, how much darkness and radio
silence it can take. Sightline answers in words. It fits, it fits with little margin, or it does
not and why, with the next landing that does.

## How it is built

A Python pipeline reads NASA's LOLA terrain models and SPICE kernels and computes the horizon and
the Sun's and Earth's positions for each site. The front end is React and TypeScript.

It runs on Google Cloud as four Cloud Run services, each with its own image, identity and deploy:
the web server, saved plans, the co-pilot, and a private worker that counts questions. A global
load balancer with a CDN and an edge firewall sends each path to its service. Every piece of it is
declared in Terraform and applied from GitHub Actions, which signs in to Google Cloud with no
stored keys.

Merging to `main` deploys one service at a time. Each new version starts with no visitors, is
tested, then takes a share of traffic, and rolls back by itself if its checks fail.

## Who wrote the code

AI coding agents wrote most of it: nearly all the code, tests, Terraform and docs. I set the
direction, reviewed the work and made the calls, and I led the six people on the team. The
repository says the same in its `AI_USAGE.md`.

The architecture decisions were mine to make. Three of them: one server split into four services
with separate identities, the rule that the co-pilot never types a number (the server fills in
every figure from computed data), and deploys that prove themselves before visitors reach them.
