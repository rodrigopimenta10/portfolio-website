"""One module per system. Each has a `check(client, now)` that returns a Finding or raises."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol

import httpx

from portfolio_status.errors import CheckFailed
from portfolio_status.models import Finding


class Source(Protocol):
    id: str
    name: str
    url: str
    ttl_seconds: float

    async def check(self, client: httpx.AsyncClient, now: datetime) -> Finding: ...


def parse_json_object(response: httpx.Response, what: str) -> dict[str, Any]:
    """The response body as a JSON object, or CheckFailed saying what came back instead."""
    try:
        body = response.json()
    except ValueError as error:
        raise CheckFailed(f"{what} did not return JSON") from error
    if not isinstance(body, dict):
        raise CheckFailed(f"{what} returned JSON of an unexpected shape")
    return body


def parse_time(value: object, what: str) -> datetime:
    """An ISO 8601 timestamp with a zone, or CheckFailed."""
    if not isinstance(value, str):
        raise CheckFailed(f"{what} is missing")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise CheckFailed(f"{what} is not a timestamp") from error
    if parsed.tzinfo is None:
        raise CheckFailed(f"{what} has no time zone")
    return parsed


def join_words(words: list[str]) -> str:
    """["a"] -> "a"; ["a", "b"] -> "a and b"; ["a", "b", "c"] -> "a, b and c"."""
    if len(words) <= 1:
        return "".join(words)
    return f"{', '.join(words[:-1])} and {words[-1]}"
