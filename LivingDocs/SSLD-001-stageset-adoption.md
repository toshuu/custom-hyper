<!-- ss-living-doc v1 -->
# SSLD-001: Add ss-living-doc to Custom Hyper

## STATE
doc_id: SSLD-001
status: DONE
current_task: T003
tasks_done: 3
tasks_total: 3
skeleton: -
spec_revision: 1
next_command: python3 scripts/ss-living-doc.py LivingDocs/SSLD-001-stageset-adoption.md --next
sync_command: python3 scripts/ss-living-doc.py LivingDocs/SSLD-001-stageset-adoption.md --sync

## RULES
<!-- rules:start -->
1. Run `next_command` from STATE. It prints your one task. Work only on that task.
2. Do the steps in order. After each step, change `[ ]` to `[x]`.
3. Touch only the file in `file:` and the files in `also_edit:`. Never touch other files.
4. Copy code blocks exactly. Do not improve them. Do not rename anything.
5. After the last step, run the command in `verify:`. Compare the output to `expect:`.
6. If the output matches: paste the first output line into `result:`, set `status: DONE`, then run `sync_command`.
7. If the output does not match: do `if_fail:`, then run `verify:` again. Try at most 2 times.
8. If it still fails, or if anything is unclear: set `status: BLOCKED`, write the reason in `blocked_reason:`, run `sync_command`, then STOP. Do not guess.
9. Never edit this RULES block. Never add, delete, or reorder tasks. Never invent results.
10. After `sync_command`, run `next_command` again. When STATE shows `status: DONE`, STOP.
<!-- rules:end -->

## TASKS

### T001: Add the ss-living-doc system
status: DONE
blocked_reason:
file: .stageset/config.yml
context: Custom Hyper had no StageSet files. This task adds the format, template, tools, and config.
do:
- [x] 1. COPY `.stageset/ss-living-doc-format.md`, `.stageset/templates/ss-living-doc.md`, `scripts/ss-living-doc.py`, and `scripts/stageset-report.py` from the StageSet repo.
- [x] 2. CREATE `.stageset/config.yml` with `runs_dir: "LivingDocs"`.
- [x] 3. CHECK the config value.
verify: `grep -c 'runs_dir: "LivingDocs"' .stageset/config.yml`
expect: 1
if_fail: Copy `.stageset/config.yml` from the StageSet repo. Run `verify:` again.
result: 1

### T002: Write the first ss-living-doc
status: DONE
blocked_reason:
file: LivingDocs/SSLD-001-stageset-adoption.md
context: This file records the setup. It shows the viewer a real document with tasks.
do:
- [x] 1. COPY `.stageset/templates/ss-living-doc.md` to `LivingDocs/SSLD-001-stageset-adoption.md`.
- [x] 2. EDIT the title, STATE, and tasks in `LivingDocs/SSLD-001-stageset-adoption.md` to match this setup.
- [x] 3. CHECK the file with the linter.
verify: `python3 scripts/ss-living-doc.py LivingDocs/SSLD-001-stageset-adoption.md | grep -c "LINT OK"`
expect: 1
if_fail: Open the file. Copy the RULES block again from the template. Run `verify:` again.
result: 1

### T003: Generate the viewer report
status: DONE
blocked_reason:
file: .stageset/report.json
context: The viewer reads only this report. The report must contain SSLD-001.
do:
- [x] 1. RUN `python3 scripts/stageset-report.py`.
- [x] 2. CHECK that the report contains the document ID.
verify: `grep -c '"id": "SSLD-001"' .stageset/report.json`
expect: 1
if_fail: Run `python3 scripts/stageset-report.py` again. Check the file name and the STATE `doc_id`.
result: 1
