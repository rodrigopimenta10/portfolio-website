"""Runs every source's check in parallel, keeps each answer for a while, and never raises."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from portfolio_status.errors import CheckFailed
from portfolio_status.models import LastKnown, StatusResponse, SystemStatus
from portfolio_status.sources import Source

log = logging.getLogger("portfolio_status")

# One source may take this long in all, even if it makes several calls.
CHECK_BUDGET_SECONDS = 6.0
# A failed check is kept for a shorter time than a good one, so recovery shows sooner.
FAILURE_TTL_SECONDS = 20.0
# A rate limit's reset can be most of an hour away; ask again at least this often anyway.
LONGEST_BACKOFF_SECONDS = 900.0


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class _Entry:
    status: SystemStatus
    expires_at: float


class StatusService:
    def __init__(
        self,
        sources: Sequence[Source],
        client: httpx.AsyncClient,
        *,
        now: Callable[[], datetime] = utc_now,
        monotonic: Callable[[], float] = time.monotonic,
        recorded: bool = False,
    ) -> None:
        self._sources = list(sources)
        self._client = client
        self._now = now
        self._monotonic = monotonic
        self._recorded = recorded
        self._entries: dict[str, _Entry] = {}
        self._last_good: dict[str, SystemStatus] = {}
        # One lock per source: when the cache expires under load, one request checks and the rest wait.
        self._locks = {source.id: asyncio.Lock() for source in self._sources}

    async def snapshot(self) -> StatusResponse:
        results = await asyncio.gather(
            *(self._one(source) for source in self._sources), return_exceptions=True
        )
        systems: list[SystemStatus] = []
        for source, result in zip(self._sources, results, strict=True):
            if isinstance(result, BaseException):
                # _one() already catches everything a check can raise. This is the last line of
                # defence: whatever happened, the caller still gets a row for this system.
                log.error("status for %s raised outside its check: %r", source.id, result)
                result = self._unknown(source, f"The check failed ({type(result).__name__}).", None)
            systems.append(result)
        return StatusResponse(generated_at=self._now(), recorded=self._recorded, systems=systems)

    def cache_seconds(self, response: StatusResponse) -> int:
        """How long a CDN may hold this answer: less when something could not be checked."""
        return 15 if any(system.state == "unknown" for system in response.systems) else 60

    async def _one(self, source: Source) -> SystemStatus:
        entry = self._entries.get(source.id)
        if entry and self._monotonic() < entry.expires_at:
            return entry.status
        async with self._locks[source.id]:
            entry = self._entries.get(source.id)
            if entry and self._monotonic() < entry.expires_at:
                return entry.status
            status, ttl = await self._check(source)
            self._entries[source.id] = _Entry(status, self._monotonic() + ttl)
            if status.state != "unknown":
                self._last_good[source.id] = status
            return status

    async def _check(self, source: Source) -> tuple[SystemStatus, float]:
        started = self._monotonic()
        now = self._now()
        try:
            async with asyncio.timeout(CHECK_BUDGET_SECONDS):
                finding = await source.check(self._client, now)
        except CheckFailed as error:
            ttl = FAILURE_TTL_SECONDS
            if error.retry_after is not None:
                ttl = min(max(error.retry_after, FAILURE_TTL_SECONDS), LONGEST_BACKOFF_SECONDS)
            return self._unknown(source, error.reason + ".", self._elapsed_ms(started)), ttl
        except (TimeoutError, httpx.TimeoutException):
            reason = f"No answer within {self._elapsed_ms(started) / 1000:.0f} seconds."
            return self._unknown(source, reason, self._elapsed_ms(started)), FAILURE_TTL_SECONDS
        except httpx.HTTPError as error:
            reason = f"Could not connect ({type(error).__name__})."
            return self._unknown(source, reason, self._elapsed_ms(started)), FAILURE_TTL_SECONDS
        except Exception as error:
            log.exception("check for %s failed unexpectedly", source.id)
            reason = f"The check itself failed ({type(error).__name__})."
            return self._unknown(source, reason, self._elapsed_ms(started)), FAILURE_TTL_SECONDS

        status = SystemStatus(
            id=source.id,
            name=source.name,
            url=source.url,
            state=finding.state,
            checked_at=now,
            fact=finding.fact,
            since=finding.since,
            since_label=finding.since_label,
            reason=finding.reason,
            latency_ms=self._elapsed_ms(started),
        )
        return status, source.ttl_seconds

    def _unknown(self, source: Source, reason: str, latency_ms: int | None) -> SystemStatus:
        last = self._last_good.get(source.id)
        return SystemStatus(
            id=source.id,
            name=source.name,
            url=source.url,
            state="unknown",
            checked_at=self._now(),
            reason=reason,
            latency_ms=latency_ms,
            last_known=LastKnown(state=last.state, fact=last.fact or "", checked_at=last.checked_at)
            if last
            else None,
        )

    def _elapsed_ms(self, started: float) -> int:
        return round((self._monotonic() - started) * 1000)
