# The status service, for Cloud Run. Build from this directory:
#   docker build -t portfolio-status .
# Two stages: uv resolves and installs into a virtualenv, then only the virtualenv and the source
# are copied into a clean Python image that runs as an unprivileged user.

FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
# Dependencies first, so a change to the source does not reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.12-slim
RUN useradd --system --uid 10001 --no-create-home status
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8080
USER 10001
EXPOSE 8080
# Cloud Run sets PORT. One worker: the cache is in memory, and an instance handles requests concurrently.
CMD ["sh", "-c", "exec uvicorn portfolio_status.app:app --host 0.0.0.0 --port \"$PORT\" --no-server-header"]
