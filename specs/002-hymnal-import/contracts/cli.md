# Contract: `hymnia-import` command line

Run with `npm run import -- <subcommand> [options]`. Every subcommand returns exit code `0` on
success, `1` on a validation or run failure, and `2` on a usage error. Human-readable output
goes to stdout and errors to stderr. `--json` prints a machine-readable summary instead.

Environment: `HYMNIA_CONTACT` (required for any command that uses the network) is the contact
address sent in the User-Agent. The CLI loads it from `.env` at the repository root
(git-ignored; see `.env.example`).

An unknown subcommand or option, a wrong number of arguments, a missing required option
(`--source`, or `--scope`/`--target`/`--basis`/`--note` for `rights set`), an invalid value for
them, or an unknown `--source` exit with `2`. A missing hymn, pending change or rights target,
invalid content, and a run that is not `ok` exit with `1`.

## Subcommands

| Subcommand | Purpose | Spec |
|------------|---------|------|
| `run --source <id> [--hymnal <id>…] [--offline] [--dry-run]` | Fetch (or, with `--offline`, use only the cache), extract, match and write. `--dry-run` writes the report only. | US1, US2, US3, FR-001 |
| `report [<runId>]` | Print a report (the latest by default). | US4, FR-018 |
| `pending` | List pending changes with their diffs. | FR-011 |
| `accept <hymnId> [--source <id>]` / `reject <hymnId> [--source <id>]` | Apply or dismiss a pending change. | FR-011 |
| `duplicates` | List possible duplicates not yet decided. | FR-015 |
| `merge <hymnIdA> <hymnIdB>` / `distinct <hymnIdA> <hymnIdB>` | Record a merge decision; `merge` rewrites content immediately. | FR-016 |
| `rights set --scope <source\|hymnal\|hymn> --target <id> --basis <permission\|licence\|public-domain\|refused> [--date YYYY-MM-DD] --note "<text>"` | Record a rights decision and update the `rights` field of the affected hymns. | FR-019, FR-020 |
| `rights list` | List the decisions and how many hymns each one covers. | FR-020 |
| `check` | Validate `import/` and `content/` without network access: schemas, links, decisions, and that text matches the cached source (FR-004). | FR-003, FR-004 |

## Behaviour guaranteed by `run`

1. If `permission` is `refused` for the source, the run stops before any request. If it is
   `unknown`, a warning is printed and confirmation is required (`--yes` skips the prompt).
2. Requests respect `robots.txt`, `max(minDelayMs, Crawl-delay)`, and send the identifying
   User-Agent.
3. Extraction runs on every page before anything is written. If more than 20% of a source's
   pages fail, nothing is written for that source and its status is `aborted`.
4. Writes go to a temporary file and are then renamed. Running again with the same cache
   produces byte-identical files.
5. Content files that are not involved are never touched. Corrections and decisions are never
   overwritten.
6. Every run writes `import/reports/<runId>.json` and `.md`, even when it is aborted.
