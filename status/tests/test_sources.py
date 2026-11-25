"""Each source's reading of its upstream, on recorded and hand-edited responses."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime, timedelta

import httpx
import pytest

from conftest import (
    GITHUB_RUNS_URL,
    ORBITAL_URL,
    RECORDED_AT,
    SIGHTLINE_URL,
    Calls,
    fixture_json,
    json_answer,
)
from portfolio_status.errors import CheckFailed
from portfolio_status.models import Finding
from portfolio_status.sources import join_words
from portfolio_status.sources.aws_drill import AwsDrill
from portfolio_status.sources.orbital_watch import OrbitalWatch
from portfolio_status.sources.sightline import Sightline

JOBS_URL = "https://api.github.com/repos/rodrigopimenta10/aws-platform-terraform/actions/runs/{}/jobs"


def run_check(source, answers: dict[str, Callable], *, now: datetime = RECORDED_AT) -> tuple[Finding, Calls]:
    calls = Calls(answers)

    async def go() -> Finding:
        async with httpx.AsyncClient(transport=httpx.MockTransport(calls)) as client:
            return await source.check(client, now)

    return asyncio.run(go()), calls


def github_answers(runs: str = "recorded/github_drill_runs.json") -> dict[str, Callable]:
    answers = {GITHUB_RUNS_URL: json_answer(runs)}
    for run in fixture_json("recorded/github_drill_runs.json")["workflow_runs"]:
        answers[JOBS_URL.format(run["id"])] = json_answer(f"recorded/github_run_{run['id']}_jobs.json")
    return answers


# --- Sightline


def test_sightline_up_names_revision_and_region():
    finding, _ = run_check(Sightline(), {SIGHTLINE_URL: json_answer("recorded/sightline_status.json")})

    assert finding == Finding("up", "Serving revision clps-web-00368-545 in us-east4")


def test_sightline_that_lost_redis_is_degraded():
    finding, _ = run_check(
        Sightline(), {SIGHTLINE_URL: json_answer("edited/sightline_status_redis_fallback.json")}
    )

    assert finding.state == "degraded"
    assert finding.fact == "Serving revision clps-web-00368-545 in us-east4"
    assert "'fallback'" in finding.reason


def test_sightline_answering_503_is_down():
    finding, _ = run_check(Sightline(), {SIGHTLINE_URL: lambda request: httpx.Response(503)})

    assert finding.state == "down"
    assert finding.fact == "Its status endpoint answered HTTP 503"


def test_sightline_answering_404_is_a_failed_check_not_a_verdict():
    with pytest.raises(CheckFailed, match="answered HTTP 404"):
        run_check(
            Sightline(), {SIGHTLINE_URL: lambda request: httpx.Response(404, json={"error": "not-found"})}
        )


# --- Orbital Watch


def test_orbital_watch_fresh():
    finding, _ = run_check(
        OrbitalWatch(), {ORBITAL_URL: json_answer("edited/orbital_latest_all_sources_fresh.json")}
    )

    assert finding.state == "up"
    assert finding.fact == "7 of 7 data sources fresh"
    assert finding.since.isoformat() == "2026-11-18T19:02:05.203816+00:00"
    assert finding.since_label == "data published"


def test_orbital_watch_reads_a_document_as_the_job_really_publishes_it():
    # Recorded on 20 November 2026, the day it moved to Google Cloud, while Celestrak was refusing
    # requests: four sources fresh, two stale, one failed.
    document = fixture_json("recorded/orbital_latest.json")
    published = datetime.fromisoformat(document["generated_at"])
    finding, _ = run_check(
        OrbitalWatch(),
        {ORBITAL_URL: json_answer("recorded/orbital_latest.json")},
        now=published + timedelta(minutes=4),
    )

    assert finding.state == "degraded"
    assert finding.fact == "4 of 7 data sources fresh"
    assert finding.reason == (
        "The page is up and says so itself: 1 of its 7 sources failed and 2 of its 7 sources are stale."
    )


def test_orbital_watch_with_failed_sources_says_how_many():
    document = fixture_json("edited/orbital_latest_all_sources_fresh.json")
    document["health"]["counts"] = {"fresh": 0, "stale": 0, "failed": 7}
    finding, _ = run_check(OrbitalWatch(), {ORBITAL_URL: lambda request: httpx.Response(200, json=document)})

    assert finding.state == "degraded"
    assert finding.fact == "0 of 7 data sources fresh"
    assert finding.reason == "The page is up and says so itself: 7 of its 7 sources failed."


def test_orbital_watch_that_has_gone_quiet_is_degraded_whatever_its_counts_say():
    document = fixture_json("edited/orbital_latest_all_sources_fresh.json")
    published = datetime.fromisoformat(document["generated_at"])
    answers = {ORBITAL_URL: lambda request: httpx.Response(200, json=document)}

    on_time, _ = run_check(OrbitalWatch(), answers, now=published + timedelta(minutes=30))
    late, _ = run_check(OrbitalWatch(), answers, now=published + timedelta(minutes=31))

    assert on_time.state == "up"
    assert late.state == "degraded"
    assert late.reason == (
        "The page is up and says so itself: it last published 31 minutes ago, "
        "and it should publish every 10 minutes."
    )


def test_orbital_watch_without_counts_is_a_failed_check():
    with pytest.raises(CheckFailed, match="no source counts"):
        run_check(
            OrbitalWatch(),
            {
                ORBITAL_URL: lambda request: httpx.Response(
                    200, json={"generated_at": "2026-11-18T19:02:05+00:00", "health": {}}
                )
            },
        )


# --- The AWS platform's live drill


def test_drill_reports_the_latest_run_that_really_drilled():
    finding, calls = run_check(AwsDrill(), github_answers())

    assert finding.state == "up"
    assert finding.fact == "Last live drill passed: m1 applied to a real AWS account and destroyed (run 25)"
    assert finding.since.isoformat() == "2026-11-18T18:58:16+00:00"
    assert finding.since_label == "finished"
    # Run 25 drilled, so only its jobs were asked for.
    assert calls.count == {GITHUB_RUNS_URL: 1, JOBS_URL.format(44373926752): 1}


def test_drill_long_past_says_nothing_has_needed_one_since_and_stays_up():
    calls = Calls(github_answers())

    async def go() -> Finding:
        async with httpx.AsyncClient(transport=httpx.MockTransport(calls)) as client:
            return await AwsDrill().check(client, RECORDED_AT + timedelta(days=200))

    finding = asyncio.run(go())

    assert finding.state == "up"
    assert finding.fact == (
        "Nothing has needed a drill since the last one passed: "
        "m1 applied to a real AWS account and destroyed (run 25)"
    )
    assert finding.since.isoformat() == "2026-11-18T18:58:16+00:00"


def test_drill_walks_back_past_runs_that_skipped_their_drills():
    runs = fixture_json("recorded/github_drill_runs.json")
    # As the list stood after run 23: the newest run found nothing to drill.
    runs["workflow_runs"] = [run for run in runs["workflow_runs"] if run["run_number"] <= 23]
    answers = github_answers()
    answers[GITHUB_RUNS_URL] = lambda request: httpx.Response(200, json=runs)

    finding, _ = run_check(AwsDrill(), answers)

    assert (
        finding.fact
        == "Last live drill passed: m2 and m1 applied to a real AWS account and destroyed (run 22)"
    )


def test_drill_that_failed_is_degraded_and_names_the_stacks():
    finding, _ = run_check(AwsDrill(), github_answers("edited/github_drill_runs_up_to_run_17.json"))

    assert finding.state == "degraded"
    assert finding.fact == "Last live drill failed (run 17)"
    assert finding.reason == "In the drill of m2, vpc and m1, m2 and m1 failed, and vpc passed."


def test_drill_in_progress_is_mentioned_beside_the_last_finished_one():
    runs = fixture_json("recorded/github_drill_runs.json")
    runs["workflow_runs"].insert(
        0,
        {**runs["workflow_runs"][0], "id": 1, "run_number": 26, "status": "in_progress", "conclusion": None},
    )
    answers = github_answers()
    answers[GITHUB_RUNS_URL] = lambda request: httpx.Response(200, json=runs)

    finding, _ = run_check(AwsDrill(), answers)

    assert finding.state == "up"
    assert finding.fact.endswith("(run 25), and another is running now")


def test_drill_when_no_recent_run_drilled_reports_the_latest_run():
    runs = fixture_json("recorded/github_drill_runs.json")
    skipped = [run for run in runs["workflow_runs"] if run["run_number"] in (23, 21, 18, 15)]
    answers = github_answers()
    answers[GITHUB_RUNS_URL] = lambda request: httpx.Response(
        200, json={"total_count": 4, "workflow_runs": skipped}
    )

    finding, _ = run_check(AwsDrill(), answers)

    assert finding.state == "up"
    assert finding.fact == "Latest run after CI passed, and no stack needed a drill (run 23)"


def test_drill_asks_for_a_finished_runs_jobs_only_once():
    source = AwsDrill()
    calls = Calls(github_answers())

    async def twice() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(calls)) as client:
            await source.check(client, RECORDED_AT)
            await source.check(client, RECORDED_AT)

    asyncio.run(twice())

    assert calls.count[GITHUB_RUNS_URL] == 2
    assert calls.count[JOBS_URL.format(44373926752)] == 1


def test_drill_sends_the_token_only_when_there_is_one():
    seen: list[str | None] = []

    def capture(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("authorization"))
        return httpx.Response(500)

    for source in (AwsDrill(), AwsDrill(token="example-token")):
        with pytest.raises(CheckFailed):
            run_check(source, {GITHUB_RUNS_URL: capture})

    assert seen == [None, "Bearer example-token"]


@pytest.mark.parametrize(
    ("words", "joined"),
    [([], ""), (["m1"], "m1"), (["m1", "m2"], "m1 and m2"), (["m1", "m2", "vpc"], "m1, m2 and vpc")],
)
def test_join_words(words, joined):
    assert join_words(words) == joined
