"""This site: the status service reporting on itself. No network call; if this answers, it is up."""

from __future__ import annotations

from datetime import datetime

import httpx

from portfolio_status.models import Finding


class ThisSite:
    id = "this-site"
    name = "This site"
    url = "https://rodrigopimenta.com/how-this-site-runs"
    ttl_seconds = 0.0

    def __init__(self, *, started_at: datetime, revision: str | None, region: str | None) -> None:
        self._started_at = started_at
        self._revision = revision
        self._region = region

    async def check(self, client: httpx.AsyncClient, now: datetime) -> Finding:
        if self._revision and self._region:
            fact = f"Status service revision {self._revision} in {self._region}"
        elif self._revision:
            fact = f"Status service revision {self._revision}"
        else:
            fact = "Status service running outside Cloud Run"
        return Finding("up", fact, since=self._started_at, since_label="instance started")
