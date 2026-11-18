"""Orbital Watch: reads the health file its own page reads (data/health.json, written by each build)."""

from __future__ import annotations

from datetime import datetime, timedelta

import httpx

from portfolio_status.errors import CheckFailed
from portfolio_status.models import Finding
from portfolio_status.sources import parse_json_object, parse_time

# The site rebuilds every two hours. Three missed builds in a row means the schedule has stopped,
# whatever the file says about its sources.
EXPECTED_BUILD_EVERY = timedelta(hours=2)
BUILD_OVERDUE_AFTER = timedelta(hours=6)


class OrbitalWatch:
    id = "orbital-watch"
    name = "Orbital Watch"
    url = "https://orbital.rodrigopimenta.com"
    ttl_seconds = 60.0

    health_url = "https://orbital.rodrigopimenta.com/data/health.json"

    async def check(self, client: httpx.AsyncClient, now: datetime) -> Finding:
        response = await client.get(self.health_url)
        if response.status_code >= 500:
            return Finding(
                state="down",
                fact=f"Its health file answered HTTP {response.status_code}",
                reason="The site's host is failing.",
            )
        if response.status_code != 200:
            raise CheckFailed(f"Orbital Watch's health file answered HTTP {response.status_code}")
        body = parse_json_object(response, "Orbital Watch's health file")

        built_at = parse_time(body.get("generated_at"), "Orbital Watch's build time")
        counts = body.get("counts")
        if not isinstance(counts, dict):
            raise CheckFailed("Orbital Watch's health file has no source counts")
        try:
            fresh, stale, failed = (int(counts[key]) for key in ("fresh", "stale", "failed"))
        except (KeyError, TypeError, ValueError) as error:
            raise CheckFailed("Orbital Watch's health file has no source counts") from error
        total = fresh + stale + failed

        fact = f"{fresh} of {total} data sources fresh"
        problems: list[str] = []
        if failed:
            problems.append(f"{failed} of its {total} sources failed")
        if stale:
            problems.append(f"{stale} of its {total} sources {'is' if stale == 1 else 'are'} stale")
        if now - built_at > BUILD_OVERDUE_AFTER:
            hours = int((now - built_at).total_seconds() // 3600)
            problems.append(
                f"its last build was {hours} hours ago, and it should rebuild every "
                f"{int(EXPECTED_BUILD_EVERY.total_seconds() // 3600)}"
            )
        if problems:
            reason = "The page is up and says so itself: " + "; ".join(problems) + "."
            return Finding("degraded", fact, reason, since=built_at, since_label="data built")
        return Finding("up", fact, since=built_at, since_label="data built")
