"""The web app: GET /api/status and GET /api/healthz.

Environment:
  K_REVISION            set by Cloud Run; reported in the "This site" row.
  STATUS_REGION         the Cloud Run region, set by Terraform (Cloud Run does not put it in the
                        environment).
  GITHUB_TOKEN          optional. Without it GitHub allows 60 API calls an hour per address, which
                        the cache keeps under.
  STATUS_RECORDED_DIR   a scenario directory (see recorded.py). Tests and CI only: the answer is
                        marked "recorded".
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

import httpx
from fastapi import FastAPI, Response

from portfolio_status import __version__
from portfolio_status.models import StatusResponse
from portfolio_status.recorded import RecordedSources
from portfolio_status.service import StatusService, utc_now
from portfolio_status.sources.aws_drill import AwsDrill
from portfolio_status.sources.orbital_watch import OrbitalWatch
from portfolio_status.sources.sightline import Sightline
from portfolio_status.sources.site import ThisSite

log = logging.getLogger("portfolio_status")

USER_AGENT = f"portfolio-status/{__version__} (+https://rodrigopimenta.com/how-this-site-runs)"
# Each outbound call: 2 s to connect, 4 s for each later step of the answer.
CALL_TIMEOUT_SECONDS = 4.0
CONNECT_TIMEOUT_SECONDS = 2.0
TIMEOUT = httpx.Timeout(CALL_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS)


def create_app(
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    now: Callable[[], datetime] | None = None,
    recorded: bool = False,
    environ: dict[str, str] | None = None,
) -> FastAPI:
    env = os.environ if environ is None else environ

    recorded_dir = env.get("STATUS_RECORDED_DIR")
    if recorded_dir and transport is None:
        sources_on_disk = RecordedSources(Path(recorded_dir))
        transport = sources_on_disk.transport()
        recorded = True
        if now is None:
            # Recorded files carry their own dates, so the clock starts at the moment they were
            # recorded and runs forward from there. Ages on the page then read as they did live.
            started = time.monotonic()
            recorded_at = sources_on_disk.recorded_at

            def now() -> datetime:
                return recorded_at + timedelta(seconds=time.monotonic() - started)

        log.warning("answering from recorded sources in %s; this is not live data", recorded_dir)
    clock = now or utc_now

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with httpx.AsyncClient(
            transport=transport,
            timeout=TIMEOUT,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=False,
        ) as client:
            app.state.service = StatusService(
                [
                    Sightline(),
                    OrbitalWatch(),
                    AwsDrill(token=env.get("GITHUB_TOKEN") or None),
                    ThisSite(
                        started_at=clock(),
                        revision=env.get("K_REVISION") or None,
                        region=env.get("STATUS_REGION") or None,
                    ),
                ],
                client,
                now=clock,
                recorded=recorded,
                call_timeout_seconds=CALL_TIMEOUT_SECONDS,
                connect_timeout_seconds=CONNECT_TIMEOUT_SECONDS,
            )
            yield

    # No generated docs: two read-only endpoints, described in the README.
    app = FastAPI(
        title="portfolio-status", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None
    )

    @app.get("/api/status", response_model=StatusResponse, response_model_exclude_none=True)
    async def status(response: Response) -> StatusResponse:
        service: StatusService = app.state.service
        snapshot = await service.snapshot()
        seconds = service.cache_seconds(snapshot)
        # Browsers keep it briefly; the CDN in front (Firebase Hosting) may keep it for `seconds`.
        response.headers["Cache-Control"] = f"public, max-age={min(seconds, 30)}, s-maxage={seconds}"
        return snapshot

    @app.get("/api/healthz")
    async def healthz(response: Response) -> dict[str, bool]:
        response.headers["Cache-Control"] = "no-store"
        return {"ok": True}

    return app


app = create_app()
