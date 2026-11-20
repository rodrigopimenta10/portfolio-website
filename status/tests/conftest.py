"""Shared helpers. No test reaches the network: every outbound call is answered from a file or a stub."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from portfolio_status.app import create_app

FIXTURES = Path(__file__).parent / "fixtures"
# The moment the recordings were made; the tests' clock stands here unless a test moves it.
RECORDED_AT = datetime(2026, 11, 18, 19, 7, 44, tzinfo=UTC)

SIGHTLINE_URL = "https://lunarsightline.com/api/status"
ORBITAL_URL = "https://storage.googleapis.com/portfolio-prod-0p1ht-orbital-watch-public/latest.json"
GITHUB_RUNS_URL = (
    "https://api.github.com/repos/rodrigopimenta10/aws-platform-terraform"
    "/actions/workflows/live-drill.yml/runs?event=workflow_run&per_page=10"
)


def fixture_json(relative: str) -> dict:
    return json.loads((FIXTURES / relative).read_text())


def scenario_dir(name: str) -> Path:
    return FIXTURES / "scenarios" / name


@pytest.fixture
def client_for() -> Callable[..., TestClient]:
    """A test client for the app, started on a recorded scenario with the clock at RECORDED_AT."""
    clients: list[TestClient] = []

    def make(
        scenario: str = "all-up", *, now: datetime = RECORDED_AT, env: dict[str, str] | None = None
    ) -> TestClient:
        environ = {"STATUS_RECORDED_DIR": str(scenario_dir(scenario)), **(env or {})}
        client = TestClient(create_app(environ=environ, now=lambda: now))
        client.__enter__()
        clients.append(client)
        return client

    yield make
    for client in clients:
        client.__exit__(None, None, None)


def by_id(body: dict) -> dict[str, dict]:
    return {system["id"]: system for system in body["systems"]}


class Calls:
    """A stub transport that counts calls per URL and answers from a table the test can change."""

    def __init__(self, answers: dict[str, Callable[[httpx.Request], httpx.Response]]) -> None:
        self.answers = answers
        self.count: dict[str, int] = {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        self.count[url] = self.count.get(url, 0) + 1
        if url not in self.answers:
            raise httpx.ConnectError("no stub for this URL", request=request)
        return self.answers[url](request)


def json_answer(relative: str, status: int = 200, headers: dict[str, str] | None = None):
    body = (FIXTURES / relative).read_bytes()

    def answer(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status, content=body, headers={"content-type": "application/json", **(headers or {})}
        )

    return answer
