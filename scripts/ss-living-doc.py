#!/usr/bin/env python3
"""StageSet ss-living-doc helper (format: ss-living-doc v1).

  python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md           check the file
  python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md --next    print the current task only
  python scripts/ss-living-doc.py LivingDocs/SSLD-001-x.md --sync    fix STATE, start next task

Standard library only. Exit code 0 = OK, 1 = errors.
"""
import argparse
import re
import sys
from pathlib import Path

MARKERS = ("<!-- ss-living-doc v1 -->", "<!-- stageset-run v1 -->")
VERBS = {"CREATE", "EDIT", "RUN", "CHECK", "DELETE", "COPY", "APPEND"}
TASK_STATUS = {"TODO", "DOING", "DONE", "BLOCKED"}
RUN_STATUS = {"NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE"}
STATE_KEYS = ["doc_id", "status", "current_task", "tasks_done", "tasks_total",
              "skeleton", "spec_revision", "next_command", "sync_command"]
TASK_KEYS = ["status", "blocked_reason", "file", "context", "verify", "expect",
             "if_fail", "result"]
VAGUE = ["etc", "as needed", "appropriate", "and so on", "similar", "tbd",
         "somehow", "properly", "if necessary", "relevant"]
MAX_STEPS = 8
MAX_TASKS = 30

FIELD_RE = re.compile(r"^([a-z_]+):[ \t]*(.*)$")
STEP_RE = re.compile(r"^- \[( |x)\] (\d+)\. ([A-Z]+)\b(.*)$")
TASK_RE = re.compile(r"^### (T\d{3}): (.+?)\s*$")


def parse(text):
    lines = text.split("\n")
    doc = {"lines": lines, "state": {}, "state_line": {}, "tasks": [],
           "title": "", "rules": None, "problems": []}
    section = None
    task = None
    fence = False
    rules_on = False
    rules = []
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            fence = not fence
            continue
        if fence:
            continue
        if line.startswith("# ") and not doc["title"]:
            doc["title"] = line[2:].strip()
            continue
        if line.startswith("## "):
            if task is not None:
                task["end"] = i
                task = None
            section = line[3:].strip().upper()
            continue
        if "<!-- rules:start -->" in line:
            rules_on = True
            continue
        if "<!-- rules:end -->" in line:
            rules_on = False
            doc["rules"] = "\n".join(rules).strip()
            continue
        if rules_on:
            rules.append(line)
            continue
        if section == "STATE":
            m = FIELD_RE.match(line)
            if m:
                doc["state"][m.group(1)] = m.group(2).strip()
                doc["state_line"][m.group(1)] = i
            continue
        if section == "TASKS":
            m = TASK_RE.match(line)
            if m:
                if task is not None:
                    task["end"] = i
                task = {"id": m.group(1), "title": m.group(2), "start": i,
                        "end": len(lines), "fields": {}, "field_line": {},
                        "steps": [], "bad_steps": []}
                doc["tasks"].append(task)
                continue
            if line.startswith("### "):
                doc["problems"].append((i + 1, "Bad task heading. Use: ### T001: Title"))
                continue
            if task is None:
                continue
            if line.startswith("- ["):
                m = STEP_RE.match(line)
                if m:
                    task["steps"].append({"done": m.group(1) == "x", "n": int(m.group(2)),
                                          "verb": m.group(3), "text": m.group(4), "line": i})
                else:
                    task["bad_steps"].append(i + 1)
                continue
            m = FIELD_RE.match(line)
            if m and m.group(1) in TASK_KEYS + ["do", "also_edit"]:
                task["fields"][m.group(1)] = m.group(2).strip()
                task["field_line"][m.group(1)] = i
    return doc


def derive(tasks):
    st = [t["fields"].get("status", "").upper() for t in tasks]
    done = sum(1 for s in st if s == "DONE")
    cur = ""
    for t, s in zip(tasks, st):
        if s != "DONE":
            cur = t["id"]
            break
    if not cur and tasks:
        cur = tasks[-1]["id"]
    if tasks and all(s == "DONE" for s in st):
        run = "DONE"
    elif any(s == "BLOCKED" for s in st):
        run = "BLOCKED"
    elif all(s == "TODO" for s in st):
        run = "NOT_STARTED"
    else:
        run = "IN_PROGRESS"
    return done, cur, run


def check(doc, canonical_rules):
    errs, warns = [], []
    lines = doc["lines"]
    for ln, msg in doc["problems"]:
        errs.append((ln, msg))
    if not any(marker in "\n".join(lines[:3]) for marker in MARKERS):
        errs.append((1, "Line 1 must be: " + MARKERS[0]))
    state = doc["state"]
    for k in STATE_KEYS:
        if not state.get(k):
            errs.append((1, "STATE is missing the value for: " + k))
    m = re.match(r"^(SSLD-\d{3}|RUN-\d{3}):", doc["title"])
    if not m:
        errs.append((1, "Title must look like: # SSLD-001: Short title"))
    elif state.get("doc_id") and state["doc_id"] != m.group(1):
        errs.append((1, "STATE doc_id does not match the title"))
    if state.get("status") and state["status"] not in RUN_STATUS:
        errs.append((doc["state_line"].get("status", 0) + 1, "STATE status must be one of: " + ", ".join(sorted(RUN_STATUS))))
    if doc["rules"] is None:
        errs.append((1, "RULES block is missing"))
    elif canonical_rules is not None and doc["rules"] != canonical_rules:
        errs.append((1, "RULES block was changed. Copy it again from .stageset/templates/ss-living-doc.md"))
    elif canonical_rules is None:
        warns.append((1, "Template not found. RULES block was not compared."))

    tasks = doc["tasks"]
    if not tasks:
        errs.append((1, "No tasks found. Use headings like: ### T001: Title"))
        return errs, warns
    if len(tasks) > MAX_TASKS:
        errs.append((1, "More than %d tasks. Split into another ss-living-doc." % MAX_TASKS))
    for idx, t in enumerate(tasks):
        tid, f = t["id"], t["fields"]
        ln = t["start"] + 1
        if tid != "T%03d" % (idx + 1):
            errs.append((ln, "%s: task ids must go T001, T002, T003 in order" % tid))
        for k in TASK_KEYS:
            if k not in f:
                errs.append((ln, "%s: missing field '%s:'" % (tid, k)))
        if "do" not in f:
            errs.append((ln, "%s: missing field 'do:'" % tid))
        status = f.get("status", "").upper()
        if status and status not in TASK_STATUS:
            errs.append((ln, "%s: status must be one of: %s" % (tid, ", ".join(sorted(TASK_STATUS)))))
        steps = t["steps"]
        if not steps:
            errs.append((ln, "%s: no steps. Use: - [ ] 1. VERB target" % tid))
        if len(steps) > MAX_STEPS:
            errs.append((ln, "%s: more than %d steps. Split the task." % (tid, MAX_STEPS)))
        for bl in t["bad_steps"]:
            errs.append((bl, "%s: bad step. Use: - [ ] 1. VERB text  (VERB: %s)" % (tid, ", ".join(sorted(VERBS)))))
        for j, s in enumerate(steps):
            if s["n"] != j + 1:
                errs.append((s["line"] + 1, "%s: steps must be numbered 1, 2, 3 in order" % tid))
            if s["verb"] not in VERBS:
                errs.append((s["line"] + 1, "%s: step %d verb '%s' is not allowed. Use: %s" % (tid, s["n"], s["verb"], ", ".join(sorted(VERBS)))))
        if f.get("verify") and not re.search(r"`[^`]+`", f["verify"]):
            errs.append((ln, "%s: verify must hold a command in backticks" % tid))
        if not f.get("file"):
            errs.append((ln, "%s: 'file:' is empty" % tid))
        if not f.get("expect"):
            errs.append((ln, "%s: 'expect:' is empty" % tid))
        if len(f.get("context", "")) > 240:
            warns.append((ln, "%s: context is longer than 240 characters" % tid))
        blob = (f.get("context", "") + " " + " ".join(s["text"] for s in steps)).lower()
        for w in VAGUE:
            if re.search(r"\b" + re.escape(w) + r"\b", blob):
                warns.append((ln, "%s: vague word '%s'. Write exact text." % (tid, w)))
        if status == "DONE":
            if any(not s["done"] for s in steps):
                errs.append((ln, "%s: status is DONE but some steps are not [x]" % tid))
            if not f.get("result"):
                errs.append((ln, "%s: status is DONE but 'result:' is empty" % tid))
        if status == "TODO" and any(s["done"] for s in steps):
            errs.append((ln, "%s: status is TODO but some steps are [x]" % tid))
        if status == "BLOCKED" and not f.get("blocked_reason"):
            errs.append((ln, "%s: status is BLOCKED but 'blocked_reason:' is empty" % tid))

    done, cur, run = derive(tasks)
    seen_open = False
    for t in tasks:
        s = t["fields"].get("status", "").upper()
        if s != "DONE":
            seen_open = True
        elif seen_open:
            errs.append((t["start"] + 1, "%s is DONE but an earlier task is not DONE" % t["id"]))
    doing = [t["id"] for t in tasks if t["fields"].get("status", "").upper() == "DOING"]
    if len(doing) > 1:
        errs.append((1, "More than one task is DOING: " + ", ".join(doing)))
    if doing and doing[0] != cur:
        errs.append((1, "Task %s is DOING but current task is %s" % (doing[0], cur)))
    expect_state = {"tasks_done": str(done), "tasks_total": str(len(tasks)),
                    "current_task": cur}
    for k, v in expect_state.items():
        if state.get(k) and state[k] != v:
            errs.append((doc["state_line"].get(k, 0) + 1, "STATE %s is '%s' but should be '%s'. Run sync_command." % (k, state[k], v)))
    if state.get("status") in RUN_STATUS and state["status"] != run and not (run == "NOT_STARTED" and state["status"] == "IN_PROGRESS" and doing):
        errs.append((doc["state_line"].get("status", 0) + 1, "STATE status is '%s' but should be '%s'. Run sync_command." % (state["status"], run)))
    return errs, warns


def sync(doc):
    lines = doc["lines"]
    tasks = doc["tasks"]
    if not tasks:
        return False
    done, cur, _ = derive(tasks)
    for t in tasks:
        if t["id"] == cur and t["fields"].get("status", "").upper() == "TODO" and done < len(tasks):
            li = t["field_line"].get("status")
            if li is not None:
                lines[li] = "status: DOING"
                t["fields"]["status"] = "DOING"
    done, cur, run = derive(tasks)
    values = {"status": run, "current_task": cur,
              "tasks_done": str(done), "tasks_total": str(len(tasks))}
    for k, v in values.items():
        li = doc["state_line"].get(k)
        if li is not None:
            lines[li] = "%s: %s" % (k, v)
    return True


def canonical(script_path):
    root = script_path.resolve().parent.parent / ".stageset" / "templates"
    for name in ("ss-living-doc.md", "living-doc.md"):
        tpl = root / name
        if tpl.exists():
            return parse(tpl.read_text(encoding="utf-8"))["rules"]
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--next", action="store_true", help="print the current task only")
    ap.add_argument("--sync", action="store_true", help="fix STATE and start the next task")
    a = ap.parse_args()
    path = Path(a.file)
    if not path.exists():
        print("LINT FAIL\nERROR: file not found: " + a.file)
        return 1
    text = path.read_text(encoding="utf-8")
    doc = parse(text)

    if a.sync:
        if sync(doc):
            path.write_text("\n".join(doc["lines"]), encoding="utf-8")
        doc = parse(path.read_text(encoding="utf-8"))

    errs, warns = check(doc, canonical(Path(__file__)))

    if a.next and not errs:
        done, cur, run = derive(doc["tasks"])
        print("SSLD %s | %d/%d done | %s" % (doc["state"].get("doc_id", "?"), done, len(doc["tasks"]), run))
        if run == "DONE":
            print("All tasks are DONE. STOP.")
            return 0
        if run == "BLOCKED":
            print("ss-living-doc is BLOCKED. STOP. Tell the user.")
            return 0
        for t in doc["tasks"]:
            if t["id"] == cur:
                print("=" * 60)
                print("\n".join(doc["lines"][t["start"]:t["end"]]).rstrip())
                print("=" * 60)
        print("When done: set status DONE, fill result, run: " + doc["state"].get("sync_command", ""))
        return 0

    print("LINT OK" if not errs else "LINT FAIL")
    for ln, msg in sorted(errs):
        print("ERROR line %d: %s" % (ln, msg))
    for ln, msg in sorted(warns):
        print("WARN  line %d: %s" % (ln, msg))
    if not errs:
        done, cur, run = derive(doc["tasks"])
        print("%d/%d tasks done | current %s | %s" % (done, len(doc["tasks"]), cur, run))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
