"""The cache: how long answers are kept, what happens when a check fails after it worked."""

from __future__ import annotations

import asyncio
from datetime import timedelta

import httpx

from conftest import GITHUB_RUNS_URL, ORBITAL_URL, RECORDED_AT, SIGHTLINE_URL, Calls, json_answer
from portfolio_status.service import StatusService
from portfolio_status.sources.aws_drill import AwsDrill
from portfolio_status.sources.orbital_watch import OrbitalWatch
from portfolio_status.sources.sightline import Sightline


class Clock:
    """Wall time and monotonic time that move only when a test says so."""

    def __init__(self) -> None:
        self.seconds = 0.0

    def now(self):
        return RECORDED_AT + timedelta(seconds=self.seconds)

    def monotonic(self) -> float:
        return self.seconds


def run(sources, calls: Calls, script):
    """Run `script(service, clock)` against a service on stubbed sources."""
    clock = Clock()

    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(calls)) as client:
            service = StatusService(sources, client, now=clock.now, monotonic=clock.monotonic)
            return await script(service, clock)

    return asyncio.run(go())


def test_an_answer_is_reused_for_sixty_seconds_then_fetched_again():
    calls = Calls({SIGHTLINE_URL: json_answer("recorded/sightline_status.json")})

    async def script(service, clock):
        first = await service.snapshot()
        clock.seconds = 59
        second = await service.snapshot()
        assert calls.count[SIGHTLINE_URL] == 1
        # The reused answer keeps the time it was really checked.
        assert second.systems[0].checked_at == first.systems[0].checked_at == RECORDED_AT
        assert second.generated_at == RECORDED_AT + timedelta(seconds=59)
        clock.seconds = 61
        third = await service.snapshot()
        assert calls.count[SIGHTLINE_URL] == 2
        assert third.systems[0].checked_at == RECORDED_AT + timedelta(seconds=61)

    run([Sightline()], calls, script)


def test_many_requests_at_once_make_one_outbound_call():
    calls = Calls({ORBITAL_URL: json_answer("recorded/orbital_health.json")})

    async def script(service, clock):
        answers = await asyncio.gather(*(service.snapshot() for _ in range(25)))
        assert {answer.systems[0].state for answer in answers} == {"up"}

    run([OrbitalWatch()], calls, script)

    assert calls.count[ORBITAL_URL] == 1


def test_a_failed_check_is_retried_sooner_and_carries_the_last_known_answer():
    calls = Calls({SIGHTLINE_URL: json_answer("recorded/sightline_status.json")})

    async def script(service, clock):
        await service.snapshot()
        calls.answers[SIGHTLINE_URL] = lambda request: httpx.Response(404)
        clock.seconds = 61
        failed = (await service.snapshot()).systems[0]
        assert failed.state == "unknown"
        assert failed.reason == "Sightline's status endpoint answered HTTP 404."
        assert failed.last_known.state == "up"
        assert failed.last_known.fact == "Serving revision clps-web-00368-545 in us-east4"
        assert failed.last_known.checked_at == RECORDED_AT

        clock.seconds = 61 + 19
        await service.snapshot()
        assert calls.count[SIGHTLINE_URL] == 2
        calls.answers[SIGHTLINE_URL] = json_answer("recorded/sightline_status.json")
        clock.seconds = 61 + 21
        recovered = (await service.snapshot()).systems[0]
        assert calls.count[SIGHTLINE_URL] == 3
        assert recovered.state == "up"
        assert recovered.last_known is None

    run([Sightline()], calls, script)


def test_a_first_failure_has_no_last_known_answer():
    calls = Calls({})

    async def script(service, clock):
        return (await service.snapshot()).systems[0]

    status = run([Sightline()], calls, script)

    assert status.state == "unknown"
    assert status.last_known is None


def test_a_failed_github_check_is_retried_after_twenty_seconds_not_five_minutes():
    calls = Calls({GITHUB_RUNS_URL: lambda request: httpx.Response(200, json={"workflow_runs": []})})

    async def script(service, clock):
        for second in (0, 25, 50, 75, 299):
            clock.seconds = second
            await service.snapshot()

    run([AwsDrill()], calls, script)

    # Every answer here is a failed check ("no finished drill run"), each kept for 20 seconds.
    assert calls.count[GITHUB_RUNS_URL] == 5


def test_github_good_answer_is_kept_five_minutes_and_a_rate_limit_waits_for_its_reset():
    from test_sources import github_answers

    calls = Calls(github_answers())

    async def script(service, clock):
        for second in (0, 100, 299):
            clock.seconds = second
            await service.snapshot()
        assert calls.count[GITHUB_RUNS_URL] == 1

        # 20:05:38 UTC is 3474 seconds after the recording; the service backs off, but never
        # for more than fifteen minutes.
        limited = {"x-ratelimit-remaining": "0", "x-ratelimit-reset": "1795032338"}
        calls.answers[GITHUB_RUNS_URL] = json_answer("edited/github_rate_limited.json", 403, limited)
        clock.seconds = 301
        status = (await service.snapshot()).systems[0]
        assert status.state == "unknown"
        assert status.last_known.fact.startswith("Last live drill passed")
        assert calls.count[GITHUB_RUNS_URL] == 2
        clock.seconds = 301 + 899
        await service.snapshot()
        assert calls.count[GITHUB_RUNS_URL] == 2
        clock.seconds = 301 + 901
        await service.snapshot()
        assert calls.count[GITHUB_RUNS_URL] == 3

    run([AwsDrill()], calls, script)


def test_a_slow_source_is_cut_off_and_does_not_hold_up_the_others():
    async def slow_check(client, now):
        await asyncio.sleep(3600)

    slow = Sightline()
    slow.check = slow_check  # type: ignore[method-assign]
    calls = Calls({ORBITAL_URL: json_answer("recorded/orbital_health.json")})

    async def script(service, clock):
        import portfolio_status.service as module

        module.CHECK_BUDGET_SECONDS, saved = 0.05, module.CHECK_BUDGET_SECONDS
        try:
            return await service.snapshot()
        finally:
            module.CHECK_BUDGET_SECONDS = saved

    snapshot = run([slow, OrbitalWatch()], calls, script)

    assert [system.state for system in snapshot.systems] == ["unknown", "up"]
    assert snapshot.systems[0].reason.startswith("No answer within")
