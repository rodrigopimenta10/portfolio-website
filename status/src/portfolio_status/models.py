"""The shapes this service returns. The site's status panel reads exactly these fields."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# "unknown" is shown on the site as "could not check": the check failed, which says nothing
# about the system itself.
State = Literal["up", "degraded", "down", "unknown"]


@dataclass(frozen=True)
class Finding:
    """What one source's check concluded. A check returns this or raises."""

    state: State
    fact: str
    reason: str | None = None
    since: datetime | None = None
    since_label: str | None = None


class LastKnown(BaseModel):
    """The last answer a source gave before its check started failing."""

    state: State
    fact: str
    checked_at: datetime


class SystemStatus(BaseModel):
    id: str
    name: str
    url: str
    state: State
    checked_at: datetime
    # One real fact about the system, read from the system itself.
    fact: str | None = None
    # A moment that goes with the fact ("data built", "finished"), for the page to show as an age.
    since: datetime | None = None
    since_label: str | None = None
    # Why the state is not "up".
    reason: str | None = None
    latency_ms: int | None = None
    last_known: LastKnown | None = None


class StatusResponse(BaseModel):
    # This service's clock when it answered. The page measures every age against this, not
    # against the visitor's clock.
    generated_at: datetime
    # True when the sources are recorded files (tests, CI), never in production.
    recorded: bool
    systems: list[SystemStatus]
