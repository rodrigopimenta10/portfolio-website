"""The two endpoints, through the real app, on recorded sources."""

from __future__ import annotations

from datetime import timedelta

import httpx
from fastapi.testclient import TestClient

from conftest import RECORDED_AT, by_id
from portfolio_status.app import create_app


def test_all_up_reports_four_systems_with_a_real_fact_each(client_for):
    response = client_for("all-up").get("/api/status")

    assert response.status_code == 200
    body = response.json()
    assert [system["id"] for system in body["systems"]] == [
        "sightline",
        "orbital-watch",
        "aws-platform",
        "this-site",
    ]
    assert {system["state"] for system in body["systems"]} == {"up"}
    systems = by_id(body)
    assert systems["sightline"]["fact"] == "Serving revision clps-web-00368-545 in us-east4"
    assert systems["orbital-watch"]["fact"] == "7 of 7 data sources fresh"
    assert systems["orbital-watch"]["since"].startswith("2026-11-18T18:02:05")
    assert systems["orbital-watch"]["since_label"] == "data built"
    assert systems["aws-platform"]["fact"] == (
        "Last live drill passed: m1 applied to a real AWS account and destroyed (run 25)"
    )
    assert systems["aws-platform"]["since"] == "2026-11-18T18:58:16Z"
    assert systems["this-site"]["fact"] == "Status service running outside Cloud Run"
    assert all("reason" not in system for system in body["systems"])


def test_answer_is_marked_recorded_and_carries_the_service_clock(client_for):
    body = client_for("all-up").get("/api/status").json()

    assert body["recorded"] is True
    assert body["generated_at"] == "2026-11-18T19:07:44Z"
    assert all(system["checked_at"] == "2026-11-18T19:07:44Z" for system in body["systems"])


def test_a_cdn_may_hold_a_good_answer_for_a_minute(client_for):
    response = client_for("all-up").get("/api/status")

    assert response.headers["cache-control"] == "public, max-age=30, s-maxage=60"


def test_one_source_timing_out_becomes_could_not_check_and_the_rest_still_answer(client_for):
    response = client_for("sightline-timeout").get("/api/status")

    assert response.status_code == 200
    systems = by_id(response.json())
    assert systems["sightline"]["state"] == "unknown"
    assert systems["sightline"]["reason"].startswith("No answer within")
    assert "fact" not in systems["sightline"]
    assert [systems[name]["state"] for name in ("orbital-watch", "aws-platform", "this-site")] == ["up"] * 3
    # An answer with a failed check in it is held for less time, so recovery shows sooner.
    assert response.headers["cache-control"] == "public, max-age=15, s-maxage=15"


def test_every_source_unreachable_still_answers_200_and_says_so():
    def unreachable(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("network is unreachable", request=request)

    with TestClient(
        create_app(transport=httpx.MockTransport(unreachable), now=lambda: RECORDED_AT, environ={})
    ) as client:
        response = client.get("/api/status")

    assert response.status_code == 200
    systems = by_id(response.json())
    for name in ("sightline", "orbital-watch", "aws-platform"):
        assert systems[name]["state"] == "unknown"
        assert systems[name]["reason"] == "Could not connect (ConnectError)."
    assert systems["this-site"]["state"] == "up"
    assert response.json()["recorded"] is False


def test_a_bug_in_a_check_is_reported_as_could_not_check_not_as_a_500(client_for, monkeypatch):
    from portfolio_status.sources.orbital_watch import OrbitalWatch

    async def broken(self, client, now):
        raise RuntimeError("a bug")

    monkeypatch.setattr(OrbitalWatch, "check", broken)
    response = client_for("all-up").get("/api/status")

    assert response.status_code == 200
    systems = by_id(response.json())
    assert systems["orbital-watch"]["state"] == "unknown"
    assert systems["orbital-watch"]["reason"] == "The check itself failed (RuntimeError)."
    assert systems["sightline"]["state"] == "up"


def test_html_where_json_was_expected_is_could_not_check():
    def html(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=b"<!doctype html><title>hello</title>", headers={"content-type": "text/html"}
        )

    with TestClient(
        create_app(transport=httpx.MockTransport(html), now=lambda: RECORDED_AT, environ={})
    ) as client:
        systems = by_id(client.get("/api/status").json())

    assert systems["sightline"]["reason"] == "Sightline's status endpoint did not return JSON."
    assert systems["orbital-watch"]["reason"] == "Orbital Watch's health file did not return JSON."
    assert systems["aws-platform"]["reason"] == "GitHub's API did not return JSON."


def test_a_degraded_source_keeps_its_fact_and_gives_the_reason(client_for):
    systems = by_id(client_for("orbital-degraded").get("/api/status").json())

    assert systems["orbital-watch"]["state"] == "degraded"
    assert systems["orbital-watch"]["fact"] == "3 of 7 data sources fresh"
    assert systems["orbital-watch"]["reason"] == (
        "The page is up and says so itself: 4 of its 7 sources are stale."
    )


def test_github_rate_limit_is_could_not_check_with_the_reset_time(client_for):
    systems = by_id(client_for("github-rate-limited").get("/api/status").json())

    assert systems["aws-platform"]["state"] == "unknown"
    assert systems["aws-platform"]["reason"] == (
        "GitHub's hourly limit on anonymous API calls is used up; it resets at 20:05 UTC."
    )


def test_this_site_reports_its_cloud_run_revision_and_region(client_for):
    env = {"K_REVISION": "portfolio-status-00007-abc", "STATUS_REGION": "us-east4"}
    systems = by_id(client_for("all-up", env=env).get("/api/status").json())

    assert systems["this-site"]["fact"] == "Status service revision portfolio-status-00007-abc in us-east4"
    assert systems["this-site"]["since_label"] == "instance started"


def test_orbital_watch_is_degraded_when_its_builds_have_stopped(client_for):
    late = RECORDED_AT + timedelta(hours=9)
    systems = by_id(client_for("all-up", now=late).get("/api/status").json())

    assert systems["orbital-watch"]["state"] == "degraded"
    assert (
        "its last build was 10 hours ago, and it should rebuild every 2" in systems["orbital-watch"]["reason"]
    )


def test_healthz(client_for):
    response = client_for("all-up").get("/api/healthz")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["cache-control"] == "no-store"


def test_no_generated_docs_are_served(client_for):
    client = client_for("all-up")

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
