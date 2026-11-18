"""The recorded transport itself: it must never let a call through to the network."""

from __future__ import annotations

import httpx
import pytest

from conftest import SIGHTLINE_URL, scenario_dir
from portfolio_status.recorded import RecordedSources


def test_a_url_the_scenario_does_not_list_fails_instead_of_reaching_the_network():
    transport = RecordedSources(scenario_dir("all-up")).transport()

    with (
        httpx.Client(transport=transport) as client,
        pytest.raises(httpx.ConnectError, match="no recorded response"),
    ):
        client.get("https://example.com/")


def test_a_recorded_timeout_raises_a_timeout():
    transport = RecordedSources(scenario_dir("sightline-timeout")).transport()

    with httpx.Client(transport=transport) as client, pytest.raises(httpx.ReadTimeout):
        client.get(SIGHTLINE_URL)


@pytest.mark.parametrize(
    "name", ["all-up", "sightline-timeout", "orbital-degraded", "github-rate-limited", "drill-failed"]
)
def test_every_scenario_loads(name):
    assert RecordedSources(scenario_dir(name)).recorded_at.isoformat() == "2026-11-18T19:07:44+00:00"
