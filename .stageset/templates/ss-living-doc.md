<!-- ss-living-doc v1 -->
# SSLD-000: Example living doc

## STATE
doc_id: SSLD-000
status: NOT_STARTED
current_task: T001
tasks_done: 0
tasks_total: 3
skeleton: Skeletons/example.md
spec_revision: 1
next_command: python scripts/ss-living-doc.py LivingDocs/SSLD-000-example.md --next
sync_command: python scripts/ss-living-doc.py LivingDocs/SSLD-000-example.md --sync

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

### T001: Create hello.py
status: TODO
blocked_reason:
file: Code/hello.py
context: Code/ must exist. This task makes the first file of the example project.
do:
- [ ] 1. CREATE `Code/hello.py` with the code block below.

   ```python
   def hello(name):
       return "Hello, " + name
   ```
- [ ] 2. CHECK that `Code/hello.py` has 2 lines.
verify: `python -c "import sys; sys.path.insert(0,'Code'); import hello; print(hello.hello('A'))"`
expect: Hello, A
if_fail: Open `Code/hello.py`. Make it match the code block in step 1 exactly. Run `verify:` again.
result:

### T002: Add shout function
status: TODO
blocked_reason:
file: Code/hello.py
context: Code/hello.py has a function hello(name). This task adds a second function below it.
do:
- [ ] 1. APPEND to `Code/hello.py` the code block below. Put 1 empty line before it.

   ```python
   def shout(name):
       return hello(name).upper()
   ```
- [ ] 2. CHECK that `Code/hello.py` still contains `def hello(name):`.
verify: `python -c "import sys; sys.path.insert(0,'Code'); import hello; print(hello.shout('a'))"`
expect: HELLO, A
if_fail: Open `Code/hello.py`. Make sure `shout` is below `hello` and is indented like `hello`. Run `verify:` again.
result:

### T003: Update skeleton metadata
status: TODO
blocked_reason:
file: Skeletons/example.md
context: All code tasks are done. This task records that the code implements spec_revision 1.
do:
- [ ] 1. EDIT `Skeletons/example.md`: find the line `implemented_revision: 0` and replace it with `implemented_revision: 1`.
verify: `grep -c "implemented_revision: 1" Skeletons/example.md`
expect: 1
if_fail: Open `Skeletons/example.md`. Find the line that starts with `implemented_revision:`. Change the number to 1. Run `verify:` again.
result:
