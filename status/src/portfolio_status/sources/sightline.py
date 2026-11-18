"""Sightline: asks the live site's own status endpoint which revision is serving, and where."""

from __future__ import annotations

from datetime import datetime

import httpx

from portfolio_status.errors import CheckFailed
from portfolio_status.models import Finding
from portfolio_status.sources import parse_json_object


class Sightline:
    id = "sightline"
    name = "Sightline"
    url = "https://lunarsightline.com"
    ttl_seconds = 60.0

    status_url = "https://lunarsightline.com/api/status"

    async def check(self, client: httpx.AsyncClient, now: datetime) -> Finding:
        response = await client.get(self.status_url)
        if response.status_code >= 500:
            return Finding(
                state="down",
                fact=f"Its status endpoint answered HTTP {response.status_code}",
                reason="The site is reachable but its server is failing.",
            )
        if response.status_code != 200:
            raise CheckFailed(f"Sightline's status endpoint answered HTTP {response.status_code}")
        body = parse_json_object(response, "Sightline's status endpoint")

        revision = body.get("revision")
        region = body.get("region")
        if isinstance(revision, str) and isinstance(region, str):
            fact = f"Serving revision {revision} in {region}"
        elif isinstance(revision, str):
            fact = f"Serving revision {revision}"
        else:
            fact = "Answering, without naming its revision"

        # The server says where its rate limits and cache are served from right now. "reconnecting"
        # and "fallback" mean it has lost Redis and is carrying on without it.
        redis = body.get("redis")
        redis_state = redis.get("state") if isinstance(redis, dict) else None
        if redis_state in ("reconnecting", "fallback"):
            return Finding(
                state="degraded",
                fact=fact,
                reason=f"Serving, but its Redis is in state {redis_state!r}: it is running on its fallback.",
            )
        return Finding(state="up", fact=fact)
