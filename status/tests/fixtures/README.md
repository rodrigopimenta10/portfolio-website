# Recorded responses

`recorded/` holds real responses, fetched without credentials on 2026-11-18 at 19:07 UTC:

| File | From |
|---|---|
| `sightline_status.json` | `https://lunarsightline.com/api/status` |
| `orbital_health.json` | `https://orbital.rodrigopimenta.com/data/health.json` |
| `github_drill_runs.json` | `https://api.github.com/repos/rodrigopimenta10/aws-platform-terraform/actions/workflows/live-drill.yml/runs?event=workflow_run&per_page=10` |
| `github_run_<id>_jobs.json` | `https://api.github.com/repos/rodrigopimenta10/aws-platform-terraform/actions/runs/<id>/jobs` |

Two changes were made to them. The GitHub files are cut down to the fields the service reads
(the full responses carry commit authors and several kilobytes of URLs per run). In the Sightline
file the value of `signIn`, a public OAuth client ID, is replaced with `REDACTED`.

`edited/` holds copies changed by hand to show states that were not happening when the recording
was made (a stale Orbital Watch source, a Sightline that has lost Redis). Each says what was changed
in its file name.

`scenarios/` are the directories the service is started with (`STATUS_RECORDED_DIR`), each an
`index.json` that maps URLs to these files. See `src/portfolio_status/recorded.py`.
