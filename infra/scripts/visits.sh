#!/usr/bin/env bash
# Page views of the portfolio site per day and page, from the status service's log.
#
#   scripts/visits.sh [days]      default 30, which is how long Cloud Logging keeps these entries
#
# Each view is one log line written by POST /api/hit: the page's path and nothing else. Browsers
# that ask not to be tracked, and automated ones, send none, so these are low estimates.
set -euo pipefail
PROJECT="${PROJECT:-portfolio-prod-0p1ht}"
DAYS="${1:-30}"
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="portfolio-status" AND jsonPayload.event="page_view"' \
  --project "$PROJECT" --freshness="${DAYS}d" --limit=100000 \
  --format='value(timestamp.date("%Y-%m-%d"), jsonPayload.path)' |
  sort | uniq -c | awk '{ printf "%s  %-40s %s\n", $2, $3, $1 }'
