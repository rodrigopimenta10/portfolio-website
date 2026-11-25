---
title: Sightline
order: 1
summary: A lunar landing-site planner. It shows when the Sun and Earth are in view from a landing site at the Moon's south pole, every hour from 2026 to 2049, and whether a landing date fits a mission's limits.
role: I led the six-person team behind it (NASA Space Apps 2026). I assigned the work, reviewed the team's pull requests, owned the architecture decisions and built all of the Google Cloud infrastructure. AI coding agents wrote most of the code, under my direction and review.
result: Sun and Earth positions match JPL Horizons within 0.0071° over 5,469,984 hourly checks. Deploys go out as a canary and roll back automatically. 2,020 tests run in CI.
stack:
  - Python
  - TypeScript and React
  - Google Cloud Run
  - Terraform
  - Firestore
  - Redis
  - Pub/Sub and BigQuery
  - GitHub Actions
live: https://lunarsightline.com
code: https://github.com/shackleton-station/sightline
video: https://youtu.be/YJMlGcogtI0
screenshot:
  src: ../../assets/screens/sightline.webp
  alt: Sightline's front page. The Moon seen from above its south pole, half lit, with marked landing sites, a time bar set to 27 November 2026 and the Scout co-pilot open on the right.
  caption: lunarsightline.com on 18 November 2026.
architecture:
  caption: The architecture as it ran for the hackathon weekend. On a phone, scroll sideways for all of it.
  image:
    src: ../../assets/screens/sightline-architecture-hackathon.webp
    alt: "Sightline’s architecture for the hackathon weekend, in six areas: edge (browser, load balancer and CDN, Cloud Armor, NASA Moon Trek, backend buckets), the request path on Cloud Run (web, plans, the Scout co-pilot, Firestore, Cloud Storage, Redis, Text-to-Speech, the Anthropic API and JPL Horizons), async events (Pub/Sub, an events worker, BigQuery, a dead-letter queue), build and deploy (GitHub Actions, Terraform, Artifact Registry, canary deploys), and observability."
card:
  summary: A lunar landing-site planner. It shows when the Sun and Earth are in view from a site at the Moon’s south pole, every hour from 2026 to 2049.
  alt: "Sightline: the Moon seen from above its south pole, with marked landing sites and a time bar"
  claim: 0.0071° from JPL Horizons
  detail: over 5,469,984 hourly checks. I led the team of six and built all of the Google Cloud infrastructure.
  tags:
    - Python
    - Cloud Run ×4
    - Terraform
    - 2,020 tests in CI
    - canary deploys
---

## What it does

A lander at the Moon's south pole needs the Sun for power and Earth for a direct radio link, and
there both only skim the horizon, so the hills decide when each is in view. Sightline computes
that for 13 sites, every hour from 2026 to 2049.

You pick a site, a landing date and a mission. Sightline answers in words: it fits, it fits with
little margin, or it does not and why, with the next landing that does.

## How it was built for the hackathon

A Python pipeline reads NASA's LOLA terrain models and SPICE kernels and computes the horizon and
the Sun's and Earth's positions for each site. The front end is React and TypeScript.

It ran on Google Cloud as four Cloud Run services behind one load balancer, each with its own
image, identity and deploy. Everything is declared in Terraform and applied from GitHub Actions
with no stored keys.

Merging to main deploys one service at a time. Each new version starts with no visitors, is
tested, then takes a share of traffic, and rolls back by itself if its checks fail.

<!-- architecture -->

## Who wrote the code

AI coding agents wrote most of it: nearly all the code, tests, Terraform and docs. I set the
direction, reviewed the work and made the calls, and I led the six people on the team.

The architecture decisions were mine. Three of them: one server split into four services with
separate identities, the rule that the co-pilot never types a number, and deploys that prove
themselves before visitors reach them.
