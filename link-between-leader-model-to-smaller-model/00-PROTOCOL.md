# Leader to Worker Protocol

Version: 1.0
Date: 2026-10-30
Folder: `custom-hyper/link-between-leader-model-to-smaller-model/`

This file controls how the leader model and the worker model work together.
It is not product documentation. It is the coordination contract.

## 0. Read order

Read in this order. Stop at the first conflict. Report the conflict. Do not guess.

1. The user's grand living doc. Path is TBD. The user will add it later. It overrides all other files.
2. This file: `00-PROTOCOL.md`.
3. The one active task file: `01-TASK-*.md`.
4. `custom-hyper/AGENTS.md`.
5. `custom-hyper/docs/LIVING.md`.
6. `custom-hyper/docs/GRAND_LIVING.md`.
7. Only the code files named in the active task.

Do not read session logs, old products, or unrelated task files.

## 1. Roles

Leader:

- Writes one task at a time.
- Gives exact files, steps, checks, and score rules.
- Reviews the worker output.
- Runs the acceptance commands.
- Scores the work.
- Marks the task DONE.
- Writes the next task only after DONE.

Worker:

- Reads the active task.
- Implements only that task.
- Runs the task checks.
- Reports evidence.
- Sets the task to REVIEW.
- Does not mark DONE.
- Does not start the next task.
- Does not add scope.

## 2. One task rule

Exactly one task file has `State: ACTIVE`.
The worker edits only that file and only the files listed in its "Allowed files" section.

If the worker finds a bug outside scope:

1. Add one line to `Findings` in the report.
2. Do not fix it.

If the worker wants to refactor outside scope:

1. Stop.
2. Report it as a proposal.
3. Wait.

## 3. Task states

| State | Who sets it | Meaning |
|---|---|---|
| `TODO` | Leader | Task is written. Work has not started. |
| `ACTIVE` | Leader | Task is open. Worker may start. |
| `IN_PROGRESS` | Worker | Worker is working. |
| `REVIEW` | Worker | Work and evidence are ready. |
| `RETURNED` | Leader | Work failed review. Fix the listed items. |
| `DONE` | Leader only | Work passed. Do not edit it. |
| `BLOCKED` | Worker | Worker cannot continue. Needs leader. |

The worker must not use `DONE`.

## 4. Status block

Each task file starts with this block. The worker updates only the values.

```text
State: ACTIVE
Owner: worker
Started: -
Last update: -
Attempts: 0
Self score: -/100
Leader score: -/100
```

Rules:

- One update at start. Set `IN_PROGRESS`, `Started`, `Last update`.
- One update at end. Set `REVIEW`, `Last update`, `Attempts`, `Self score`.
- On `RETURNED`, set `IN_PROGRESS`. Add 1 to `Attempts`.
- On `BLOCKED`, set `BLOCKED`. Write the exact error.

## 5. Worker loop

1. Read the active task fully.
2. Write a 3-line restatement of the goal in the report draft.
3. Run the baseline commands in the task. Save the output.
4. Do one work item at a time, in order.
5. Run the item check after each item.
6. If a check fails, fix it. Maximum 3 tries for the same error.
7. After 3 failed tries, set `BLOCKED`. Paste the exact error. Stop.
8. Run the full acceptance section.
9. Set `REVIEW`.
10. Write the report. Stop.

Do not skip a work item. Do not reorder work items.

## 6. Leader review loop

1. Read the worker report.
2. Run the acceptance commands. Do not trust the report.
3. Inspect the diff for the allowed files only.
4. Check hard fails first.
5. Score with the rubric in the task.
6. If pass: set `DONE`, update the living docs, write the next task.
7. If fail: set `RETURNED`, list numbered fixes, keep scope the same.

The leader does not add new scope during review.

## 7. Evidence contract

No evidence means no credit.

The worker must paste:

- The exact command.
- The exact output. Trim long output but keep the key lines.
- The file path and line number for each important change.
- A timing number for performance work.
- The response keys for API work. Do not paste whole JSON files.

For UI work:

- A screenshot is required.
- If a browser is not available, write `Visual check pending leader`. Do not claim visual success.

For tests:

- Paste the pass and fail counts.
- Paste the exit code.

## 8. Scoring

The task file has the full rubric.
Common rules:

- 100 points total.
- Pass is 90 points or more, and zero hard fails.
- A hard fail is an automatic `RETURNED`, even with a high score.

Hard fails:

- The editor still uses a rendered plate image as the main stage.
- One edit re-renders all boards.
- One edit rebuilds the whole stage DOM.
- The page reloads on edit.
- A console error appears on load.
- A user edit is lost.
- A new dependency is added.
- Chrome, Puppeteer, or a browser automation tool is used.
- A file is deleted without permission.
- Data under `data/` is corrupted.

## 9. Report format

Use this format. Keep it under 14 lines.

```text
STATE: REVIEW
GOAL: <one line>
CHANGED: <file:line list>
EVIDENCE: <commands and key output>
SELF SCORE: <n>/100
HARD FAILS: none
FINDINGS: <out-of-scope items or none>
BLOCKERS: <none or exact error>
NEXT: wait for leader
```

## 10. Hard rules from the repo

These rules always apply:

- The render engine stays browser-free. No Chrome at render time.
- The portal UI may use HTML and CSS. That is not a violation.
- Do not edit `../x80-video-engine/`. Shared packages are read-only.
- Do not delete files. Ask first.
- Do not add code comments unless the user asks.
- Do not add dependencies.
- Fail loud. No silent fallback.
- Keep one spec per video.
- Do not promise byte-identical MP4 files. Promise identical frames.
- Update `docs/LIVING.md` after a code change.
- Keep `docs/LIVING.md` under 300 lines.

## 11. Escalation

Set `BLOCKED` when one of these is true:

- The same error fails 3 times.
- A required file is missing.
- The task conflicts with a hard rule.
- The task needs a decision that the leader did not make.

The `BLOCKED` report must have:

1. The exact command.
2. The exact error.
3. The file and line.
4. What the worker tried.
5. The decision needed.

Do not guess. Do not change scope.

## 12. Context budget

The worker reads only these files for the active task:

- `00-PROTOCOL.md`
- the active `01-TASK-*.md`
- `AGENTS.md`
- `docs/LIVING.md`
- the files in the task "Allowed files" list

The worker does not read old session logs. The worker does not read the old X80 products.

## 13. Change log

| Date | Change |
|---|---|
| 2026-10-30 | Protocol v1.0 created. |
