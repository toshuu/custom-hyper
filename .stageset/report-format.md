# StageSet report format (stageset-report/1)

One JSON file per repo: `.stageset/report.json`. The viewer reads only this file.

## Make it

```
python scripts/stageset-report.py
git add .stageset/report.json && git commit -m "Update StageSet report" && git push
```

Make it after every ideation, coding, or push session. The script only reads. It never invents values.

## Fields

| Field | Type | Meaning |
|---|---|---|
| `schema` | string | Always `stageset-report/1`. |
| `generated_at` | string | UTC time the script ran. |
| `project` | object | `name`, `repo` (`owner/repo` or null), `branch`. |
| `totals` | object | `skeletons`, `done`, `waiting`, `draft`, `sessions`, `runs`, `runs_active`. |
| `skeletons[]` | array | `id`, `path`, `title`, `status`, `spec_revision`, `implemented_revision`, `phase`. |
| `runs[]` | array | `id`, `path`, `title`, `status`, `current_task`, `skeleton`, `tasks_total`, `tasks_done`, `tasks[]` (`id`, `title`, `status`). |
| `ideas[]` | array | `path`, `title`, `status` (or null). |
| `sessions[]` | array | `id` (`YYYYMMDD-HHMMSS-TYPE` or event file name), `date`, `type`, `summary`. |
| `commits[]` | array | `sha`, `date`, `subject`. Last 40 by default. |

## `phase` rule

- `waiting`: status is `READY` or `IN_PROGRESS` and `spec_revision > implemented_revision`.
- `done`: `spec_revision > 0` and `implemented_revision >= spec_revision`.
- `draft`: everything else.

Percent in the viewer = `done` skeletons / all skeletons.

## What the script reads

- `.stageset/config.yml` for folder names. Optional keys `runs_dir` (default `LivingDocs`) and `sessions_dir` (default `.stageset/sessions`).
- Skeleton and idea files: `@stageset key: value` lines, front matter (`---`), first 6000 characters, or table rows like `| spec_revision | 3 |`. Skeleton files can be any file type.
- `.stageset/sessions/*.md` front matter: `type`, `time`, `summary`.
- `.stageset/sessions-tracker.md`: table rows with timestamp or `SS-000000` ids. Date = timestamp column. Type = type column.
- `LivingDocs/SSLD-*.md` that start with the `ss-living-doc v1` marker. Legacy `Runs/RUN-*.md` files still load.
- `git log` for commits and `origin` for `repo`.

## ss-living-doc fields

The viewer reads the `runs[]` array. Each item is one ss-living-doc:

| Field | Meaning |
| --- | --- |
| `id` | `doc_id` from STATE, such as `SSLD-001`. |
| `title` | Title after the colon. |
| `status` | `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, or `DONE`. |
| `current_task` | Task that the weak model works on now. |
| `tasks_done` / `tasks_total` | Task progress. |
| `tasks[]` | Each task with `id`, `title`, `status`. |

The viewer shows a progress bar for each ss-living-doc, the current task, and the task list. Run reports in `.stageset/runs/` are evidence. The viewer does not use them for progress.

## If a value is wrong

The script follows `formats.md` only by guess. If a skeleton shows the wrong phase or a session has no date, fix the parser rule in `scripts/stageset-report.py`, not the report.
