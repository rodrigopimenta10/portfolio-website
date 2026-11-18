"""The one exception a check raises on purpose."""

from __future__ import annotations


class CheckFailed(Exception):
    """The check could not reach a conclusion. `reason` is shown to visitors as written."""

    def __init__(self, reason: str, *, retry_after: float | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        # Seconds to wait before asking again (a rate limit's reset), if the source said.
        self.retry_after = retry_after
