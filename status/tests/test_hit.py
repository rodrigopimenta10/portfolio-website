"""POST /api/hit: one log line per page view, and nothing for a path that is not a page's."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from portfolio_status.app import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(environ={}))


def test_a_page_view_is_logged_as_one_json_line(
    client: TestClient, capsys: pytest.CaptureFixture[str]
) -> None:
    with client:
        response = client.post("/api/hit", params={"path": "/projects/sightline"})
    assert response.status_code == 204
    assert response.headers["cache-control"] == "no-store"
    assert "set-cookie" not in response.headers
    lines = [json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")]
    assert lines == [{"severity": "INFO", "event": "page_view", "path": "/projects/sightline"}]


@pytest.mark.parametrize("path", ["https://example.com/", "/a b", "/" + "x" * 200, "/?q=1", "relative"])
def test_a_path_that_is_not_a_page_is_answered_and_not_logged(
    client: TestClient, capsys: pytest.CaptureFixture[str], path: str
) -> None:
    with client:
        response = client.post("/api/hit", params={"path": path})
    assert response.status_code == 204
    assert "page_view" not in capsys.readouterr().out


def test_it_cannot_be_read(client: TestClient) -> None:
    with client:
        assert client.get("/api/hit").status_code == 405
