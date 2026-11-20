"""Orbital Watch: reads the document its own page reads (latest.json, published by each run of its job)."""

from __future__ import annotations

from datetime import datetime, timedelta

import httpx

from portfolio_status.errors import CheckFailed
from portfolio_status.models import Finding
from portfolio_status.sources import parse_json_object, parse_time

# Its job runs every ten minutes and publishes each time. Three missed runs in a row means the
# schedule has stopped, whatever the document says about its sources. These are the job's own
# numbers (meta.pipeline in the document); they are repeated here so that a document that has
# stopped changing cannot also move the limit it is judged by.
PUBLISHES_EVERY = timedelta(minutes=10)
SILENT_AFTER = timedelta(minutes=30)


class OrbitalWatch:
    id = "orbital-watch"
    name = "Orbital Watch"
    url = "https://orbital.rodrigopimenta.com"
    ttl_seconds = 60.0

    # The public Cloud Storage object the job writes and the page fetches. Read from the bucket,
    # not through the site, so this check does not depend on the site's host being up.
    document_url = "https://storage.googleapis.com/portfolio-prod-0p1ht-orbital-watch-public/latest.json"

    async def check(self, client: httpx.AsyncClient, now: datetime) -> Finding:
        response = await client.get(self.document_url)
        if response.status_code >= 500:
            return Finding(
                state="down",
                fact=f"Its published document answered HTTP {response.status_code}",
                reason="The storage it is published to is failing.",
            )
        if response.status_code != 200:
            raise CheckFailed(f"Orbital Watch's published document answered HTTP {response.status_code}")
        body = parse_json_object(response, "Orbital Watch's published document")

        published_at = parse_time(body.get("generated_at"), "Orbital Watch's publication time")
        health = body.get("health")
        counts = health.get("counts") if isinstance(health, dict) else None
        if not isinstance(counts, dict):
            raise CheckFailed("Orbital Watch's published document has no source counts")
        try:
            fresh, stale, failed = (int(counts[key]) for key in ("fresh", "stale", "failed"))
        except (KeyError, TypeError, ValueError) as error:
            raise CheckFailed("Orbital Watch's published document has no source counts") from error
        total = fresh + stale + failed

        fact = f"{fresh} of {total} data sources fresh"
        problems: list[str] = []
        if failed:
            problems.append(f"{failed} of its {total} sources failed")
        if stale:
            problems.append(f"{stale} of its {total} sources {'is' if stale == 1 else 'are'} stale")
        silent_for = now - published_at
        if silent_for > SILENT_AFTER:
            minutes = int(silent_for.total_seconds() // 60)
            ago = f"{minutes} minutes" if minutes < 120 else f"{minutes // 60} hours"
            problems.append(
                f"it last published {ago} ago, and it should publish every "
                f"{int(PUBLISHES_EVERY.total_seconds() // 60)} minutes"
            )
        if problems:
            reason = "The page is up and says so itself: " + "; ".join(problems) + "."
            return Finding("degraded", fact, reason, since=published_at, since_label="data published")
        return Finding("up", fact, since=published_at, since_label="data published")
