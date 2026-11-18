"""Answers the service's outbound calls from files, for tests and CI. Never used in production.

A scenario is a directory with an `index.json`:

    {
      "recorded_at": "2026-11-18T19:07:44Z",
      "responses": [
        {"url": "https://example.com/a", "status": 200, "file": "../recorded/a.json"},
        {"url": "https://example.com/b", "error": "timeout"}
      ]
    }

A call to a URL the scenario does not list fails with a connection error, so a test can never
reach the network by accident.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import httpx


class RecordedSources:
    def __init__(self, directory: Path) -> None:
        index = json.loads((directory / "index.json").read_text())
        self.recorded_at = datetime.fromisoformat(index["recorded_at"].replace("Z", "+00:00"))
        self._responses: dict[str, dict[str, object]] = {}
        for entry in index["responses"]:
            if "file" in entry:
                entry = {**entry, "body": (directory / entry["file"]).read_bytes()}
            self._responses[entry["url"]] = entry

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        entry = self._responses.get(str(request.url))
        if entry is None:
            raise httpx.ConnectError(f"no recorded response for {request.url}", request=request)
        if entry.get("error") == "timeout":
            raise httpx.ReadTimeout("recorded timeout", request=request)
        if entry.get("error"):
            raise httpx.ConnectError(f"recorded failure: {entry['error']}", request=request)
        headers = {"content-type": "application/json", **dict(entry.get("headers", {}))}  # type: ignore[call-overload]
        return httpx.Response(int(entry.get("status", 200)), headers=headers, content=entry.get("body", b""))  # type: ignore[call-overload,arg-type]
