# ss-living-doc format (ss-living-doc v1)

An **ss-living-doc** is a step list for a weak coding model. A strong model writes it. A weak model follows it. One ss-living-doc implements one skeleton, or one part of one skeleton.

The name **ss-living-doc** means **StageSet living document**. Use this name in every file, prompt, and message. The short form is **ssld**.

## Goal

A weak model must finish real work without design decisions.

The format must stop these failures:

- The weak model guesses.
- The weak model skips a task.
- The weak model invents output.
- The weak model edits files that it must not touch.
- The weak model gets lost in a long document.
- The weak model changes the rules.

The format gives one small task at a time, exact files, exact code, one check, and a hard stop.

## Do not confuse the two documents

| Document | Location | Who writes it | Purpose |
| --- | --- | --- | --- |
| **ss-living-doc** | `LivingDocs/SSLD-NNN-name.md` | Strong planner | Step list for a weak coding model. |
| **Run report** | `.stageset/runs/YYYYMMDD-HHMMSS-RUN.md` | Coding agent | Evidence of one command attempt. |

`LivingDocs/` holds plans. `.stageset/runs/` holds evidence. Never put a plan in `.stageset/runs/`. Never put evidence in `LivingDocs/`.

## Who must read this file

- A planner app (ChatGPT, Claude, Gemini, or another strong model) reads this file before it writes an ss-living-doc.
- A coding agent (opencode or another agent) reads this file before it starts an ss-living-doc.
- The planner writes the file. The agent runs the file. The user reviews the result.

## Location and naming

```text
LivingDocs/
└── SSLD-001-short-name.md
```

- Use `SSLD-` and three digits.
- Add a short lower-case kebab-case name.
- Use a new number for each document. Do not reuse a number.
- A document can have at most 30 tasks. Split larger work into more documents.

Copy `.stageset/templates/ss-living-doc.md` to start.

## Tools

```bash
python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md          # check the file
python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md --next   # show ONLY the current task
python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md --sync   # fix STATE, start the next task
```

The weak model does not edit STATE. It changes only task `status:`, ticks boxes, fills `result:`, and runs `--sync`.

## Writer rules (strong planner)

1. Read this file and the skeleton first. Do not write an ss-living-doc without a skeleton.
2. One task = one file or one command. Use at most 8 steps in a task.
3. Every step starts with one verb: `CREATE EDIT RUN CHECK DELETE COPY APPEND`.
4. Use exact paths. Never write "etc", "as needed", "appropriate", "similar", "properly".
5. New code: put the full code in a fenced block inside the step. The weak model copies it.
6. Edits: write "find the line X and replace it with Y". Give the exact text.
7. `context:` is one or two lines. It repeats what the task needs. The weak model does not remember earlier tasks.
8. `verify:` is one command in backticks. It must run offline. `expect:` is the exact output or exit code.
9. `if_fail:` names the exact fix. Never write "debug it".
10. Order tasks so each task needs only the tasks before it.
11. The last task updates the skeleton metadata. Use exact find and replace. Then log the session as `coder-rules.md` says.
12. Never change the RULES block. Copy it from the template.
13. Fill every STATE line. `next_command` and `sync_command` must use the real file path.
14. After you write the file, run `--sync` once. Then run the linter. Fix every ERROR and WARN before you give the file to the agent.
15. Write in ASD-STE100-style English. Short sentences. Active voice. One instruction at a time.

## File shape

```text
<!-- ss-living-doc v1 -->
# SSLD-001: Title

## STATE
doc_id: SSLD-001
status: NOT_STARTED
current_task: T001
tasks_done: 0
tasks_total: 3
skeleton: Skeletons/example.md
spec_revision: 1
next_command: python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md --next
sync_command: python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md --sync

## RULES
<!-- rules:start -->
...copy from the template...
<!-- rules:end -->

## TASKS

### T001: Title
status: TODO
blocked_reason:
file: path
context: one or two lines
do:
- [ ] 1. VERB target and detail
verify: `command`
expect: exact output
if_fail: exact fix
result:
```

Optional field: `also_edit:` lists other files that the task may touch.

## Field rules

| Field | Rule |
| --- | --- |
| `doc_id` | Must match the title. |
| `status` | Run status: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`. |
| `current_task` | The first task that is not `DONE`. |
| `tasks_done` | Count of tasks with `status: DONE`. |
| `tasks_total` | Count of tasks. |
| `skeleton` | Path to the skeleton that this document implements. |
| `spec_revision` | The skeleton revision that this document implements. |
| `next_command` | Exact command that prints one task. |
| `sync_command` | Exact command that fixes STATE. |
| Task `status` | `TODO`, `DOING`, `DONE`, `BLOCKED`. |
| `blocked_reason` | Required only when the task status is `BLOCKED`. |
| `file` | The one file that the task changes. |
| `context` | What the weak model needs to know. Maximum 240 characters. |
| `do` | Ordered steps. Each step starts with one allowed verb. |
| `verify` | One command in backticks. |
| `expect` | Exact output or exit code. |
| `if_fail` | The exact fix to try. |
| `result` | Real output. Required when the task is `DONE`. |

## Status words

- Task: `TODO` -> `DOING` (set by `--sync`) -> `DONE` or `BLOCKED`.
- Document: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Set by `--sync`.
- Only one task can be `DOING` at a time.
- Tasks finish in order.

## Reader rules (weak coding model)

The reader rules are inside the RULES block of every file. They are also here for reference:

1. Run `next_command` from STATE. It prints your one task.
2. Work only on that task.
3. Do the steps in order. After each step, change `[ ]` to `[x]`.
4. Touch only the file in `file:` and the files in `also_edit:`.
5. Copy code blocks exactly. Do not improve them. Do not rename anything.
6. After the last step, run `verify:`. Compare the output to `expect:`.
7. If the output matches: paste the first output line into `result:`, set `status: DONE`, then run `sync_command`.
8. If the output does not match: do `if_fail:`, then run `verify:` again. Try at most 2 times.
9. If it still fails, or if anything is unclear: set `status: BLOCKED`, write the reason in `blocked_reason:`, run `sync_command`, then STOP. Do not guess.
10. Never edit the RULES block. Never add, delete, or reorder tasks. Never invent results.
11. After `sync_command`, run `next_command` again. When STATE shows `status: DONE`, STOP.

## What the linter checks

- Marker line.
- STATE keys.
- RULES block unchanged.
- Task IDs in order.
- All task fields present.
- Step verbs and step numbers.
- `verify:` has a command in backticks.
- `DONE` needs all boxes ticked and a real `result:`.
- `BLOCKED` needs `blocked_reason:`.
- Tasks finish in order.
- Only one `DOING` task.
- STATE counters match the tasks.
- Vague words (warning).

## Workflow

1. The strong planner reads the skeleton and this file.
2. The strong planner writes `LivingDocs/SSLD-NNN-name.md`.
3. The strong planner runs `--sync`, then the linter. The planner fixes every ERROR and WARN.
4. The weak model runs `--next`. It sees one task only.
5. The weak model does the task and runs `--sync`.
6. The weak model repeats until the document status is `DONE` or `BLOCKED`.
7. The planner reads the result and the run reports. The planner writes the next ss-living-doc.

## Why it works for weak models

- They read one task, not the whole file (`--next`).
- They never do bookkeeping (`--sync`).
- They cannot skip a check. `result:` must hold real output.
- They have a clear exit: `BLOCKED` plus STOP.
- They see the same structure in every file.

## Viewer

The status viewer reads ss-living-doc files through `.stageset/report.json`. Run `python scripts/stageset-report.py` after you add or update one. The viewer shows document status, current task, task progress, and the timeline.
