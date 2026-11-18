"""aws-platform-terraform: the latest live drill that ran after CI, from GitHub's public API.

A drill applies a stack into a real AWS account from GitHub Actions and destroys it again. The
workflow also runs when nothing needs drilling and then skips its drill jobs, so this looks at the
jobs of each recent run to find the last one that really applied something.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from portfolio_status.errors import CheckFailed
from portfolio_status.models import Finding
from portfolio_status.sources import join_words, parse_json_object, parse_time

REPO = "rodrigopimenta10/aws-platform-terraform"
API = "https://api.github.com"
# How many recent runs to look through for one that drilled. Each costs one API call, once.
LOOK_BACK = 4


class AwsDrill:
    id = "aws-platform"
    name = "AWS platform"
    url = f"https://github.com/{REPO}/actions/workflows/live-drill.yml"
    # Unauthenticated calls to GitHub are limited to 60 an hour per address, so ask at most
    # twelve times an hour.
    ttl_seconds = 300.0

    runs_url = f"{API}/repos/{REPO}/actions/workflows/live-drill.yml/runs?event=workflow_run&per_page=10"

    def __init__(self, token: str | None = None) -> None:
        self._headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        # A finished run's jobs never change, so each is fetched once for the life of the instance.
        self._drilled_by_run: dict[int, list[tuple[str, str]]] = {}

    async def check(self, client: httpx.AsyncClient, now: datetime) -> Finding:
        body = await self._get(client, self.runs_url, now)
        runs = body.get("workflow_runs")
        if not isinstance(runs, list):
            raise CheckFailed("GitHub's list of drill runs has an unexpected shape")

        running = any(isinstance(run, dict) and run.get("status") != "completed" for run in runs)
        finished = [run for run in runs if isinstance(run, dict) and run.get("status") == "completed"]
        if not finished:
            raise CheckFailed("GitHub lists no finished drill run")

        for run in finished[:LOOK_BACK]:
            drilled = await self._drilled(client, run, now)
            if drilled:
                return self._finding(run, drilled, running)

        # Recent runs all skipped their drills: say that, with the latest run's own result.
        latest = finished[0]
        passed = latest.get("conclusion") == "success"
        return Finding(
            state="up" if passed else "degraded",
            fact=f"Latest run after CI {'passed' if passed else 'did not pass'}; no stack needed a drill "
            f"(run {latest.get('run_number')})",
            reason=None if passed else f"The run ended as {latest.get('conclusion')!r}.",
            since=parse_time(latest.get("updated_at"), "the run's end time"),
            since_label="finished",
        )

    def _finding(self, run: dict[str, Any], drilled: list[tuple[str, str]], running: bool) -> Finding:
        stacks = [stack for stack, _ in drilled]
        failed = [stack for stack, conclusion in drilled if conclusion != "success"]
        number = run.get("run_number")
        since = parse_time(run.get("updated_at"), "the run's end time")
        suffix = "; another is running now" if running else ""
        if not failed and run.get("conclusion") == "success":
            return Finding(
                state="up",
                fact=f"Last live drill passed: {join_words(stacks)} applied to a real AWS account "
                f"and destroyed (run {number}){suffix}",
                since=since,
                since_label="finished",
            )
        what = f"{join_words(failed)} failed" if failed else f"the run ended as {run.get('conclusion')!r}"
        passed = [stack for stack in stacks if stack not in failed]
        if failed and passed:
            what += f"; {join_words(passed)} passed"
        return Finding(
            state="degraded",
            fact=f"Last live drill failed (run {number}){suffix}",
            reason=f"In the drill of {join_words(stacks)}, {what}.",
            since=since,
            since_label="finished",
        )

    async def _drilled(
        self, client: httpx.AsyncClient, run: dict[str, Any], now: datetime
    ) -> list[tuple[str, str]]:
        """(stack, conclusion) for each drill job of this run that was not skipped."""
        run_id = run.get("id")
        if not isinstance(run_id, int):
            raise CheckFailed("GitHub's list of drill runs has an unexpected shape")
        if run_id not in self._drilled_by_run:
            body = await self._get(client, f"{API}/repos/{REPO}/actions/runs/{run_id}/jobs", now)
            jobs = body.get("jobs")
            if not isinstance(jobs, list):
                raise CheckFailed("GitHub's list of drill jobs has an unexpected shape")
            self._drilled_by_run[run_id] = [
                (str(job["name"]).removeprefix("Drill ").strip(), str(job.get("conclusion")))
                for job in jobs
                if isinstance(job, dict)
                and str(job.get("name", "")).startswith("Drill ")
                and job.get("conclusion") not in (None, "skipped")
            ]
        return self._drilled_by_run[run_id]

    async def _get(self, client: httpx.AsyncClient, url: str, now: datetime) -> dict[str, Any]:
        response = await client.get(url, headers=self._headers)
        if response.status_code in (403, 429) and response.headers.get("x-ratelimit-remaining") == "0":
            retry_after: float | None = None
            when = ""
            reset = response.headers.get("x-ratelimit-reset", "")
            if reset.isdigit():
                resets_at = datetime.fromtimestamp(int(reset), tz=UTC)
                retry_after = max(0.0, (resets_at - now).total_seconds())
                when = f"; it resets at {resets_at:%H:%M} UTC"
            raise CheckFailed(
                f"GitHub's hourly limit on anonymous API calls is used up{when}", retry_after=retry_after
            )
        if response.status_code != 200:
            raise CheckFailed(f"GitHub's API answered HTTP {response.status_code}")
        return parse_json_object(response, "GitHub's API")
