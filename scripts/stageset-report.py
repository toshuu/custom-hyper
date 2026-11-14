#!/usr/bin/env python3
"""Build .stageset/report.json (format: stageset-report/1) for the StageSet viewer.

  python scripts/stageset-report.py            write .stageset/report.json
  python scripts/stageset-report.py --stdout   print JSON, write nothing

Reads project files only. Standard library only. Never invents values:
a value it cannot find is left out or set to null.
"""
import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "stageset-report/1"
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?")
KINDS = ["ideation", "coding", "push", "maintenance"]
WORK_STATUS = {"READY", "IN_PROGRESS"}


def read(p):
    try:
        return Path(p).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def git(root, *args):
    try:
        r = subprocess.run(["git", "-C", str(root)] + list(args), capture_output=True,
                           text=True, timeout=15)
        return r.stdout.strip() if r.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def read_config(root):
    cfg = {"root": ".", "code_dir": "Code", "ideas_dir": "Ideas",
           "skeletons_dir": "Skeletons", "runs_dir": "LivingDocs",
           "sessions_dir": ".stageset/sessions",
           "tracker": ".stageset/sessions-tracker.md"}
    for line in read(root / ".stageset" / "config.yml").splitlines():
        m = re.match(r'^\s*([A-Za-z_]+)\s*:\s*"?([^"#]*?)"?\s*(?:#.*)?$', line)
        if not m or not m.group(2):
            continue
        k, v = m.group(1), m.group(2).strip()
        if k in ("root", "code_dir", "ideas_dir", "skeletons_dir", "runs_dir"):
            cfg[k] = v
        elif k == "sessions_dir":
            cfg["sessions_dir"] = v
        elif "tracker" in k:
            cfg["tracker"] = v
    return cfg


def clean(v):
    return v.strip().strip("\"'` ").strip()


def meta(text):
    d = {}
    m = re.match(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", text, re.S)
    block = m.group(1) if m else text[:6000]
    for line in block.splitlines():
        am = re.search(r"@stageset\s+([A-Za-z_]+)\s*:\s*(.+?)\s*(?:\*/|-->)?\s*$", line)
        if am:
            d.setdefault(am.group(1).lower(), clean(am.group(2)))
        kv = re.match(r"^\s*[-*]?\s*`?([A-Za-z_]+)`?\s*:\s*(.+?)\s*$", line)
        if kv and "@stageset" not in line:
            d.setdefault(kv.group(1).lower(), clean(kv.group(2)))
        row = re.match(r"^\|\s*`?([A-Za-z_]+)`?\s*\|\s*`?([^|`]+?)`?\s*\|", line)
        if row:
            d.setdefault(row.group(1).lower(), row.group(2).strip())
    return d


def title_of(text, fallback):
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("# ") and "@stageset" not in s:
            return s[2:].strip()
    return fallback


def to_int(v):
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return 0


def all_files(folder):
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.rglob("*")
                  if p.is_file() and not p.name.lower().startswith("readme")
                  and ".git" not in p.parts)


def md_files(folder):
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.rglob("*.md") if not p.name.lower().startswith("readme"))


def skeletons(root, base, cfg):
    out = []
    for p in all_files(base / cfg["skeletons_dir"]):
        text = read(p)
        m = meta(text)
        spec, impl = to_int(m.get("spec_revision")), to_int(m.get("implemented_revision"))
        status = (m.get("status") or "UNKNOWN").upper()
        waiting = status in WORK_STATUS and spec > impl
        phase = "waiting" if waiting else ("done" if spec > 0 and impl >= spec else "draft")
        out.append({"id": m.get("id") or p.stem, "path": p.relative_to(root).as_posix(),
                    "title": title_of(text, p.stem), "status": status,
                    "spec_revision": spec, "implemented_revision": impl,
                    "phase": phase})
    return out


def ideas(root, base, cfg):
    out = []
    for p in md_files(base / cfg["ideas_dir"]):
        text = read(p)
        m = meta(text)
        out.append({"path": p.relative_to(root).as_posix(), "title": title_of(text, p.stem),
                    "status": (m.get("status") or "").upper() or None})
    return out


def runs(root, base, cfg):
    out = []
    folder = base / cfg["runs_dir"]
    files = []
    if folder.is_dir():
        files = sorted(p for p in folder.glob("*.md")
                       if p.name.startswith(("SSLD-", "RUN-")))
    for p in files:
        text = read(p)
        if "<!-- ss-living-doc v1 -->" not in text and "<!-- stageset-run v1 -->" not in text:
            continue
        state, tasks = {}, []
        section, task, fence = None, None, False
        for line in text.split("\n"):
            if line.lstrip().startswith("```"):
                fence = not fence
                continue
            if fence:
                continue
            if line.startswith("## "):
                section, task = line[3:].strip().upper(), None
                continue
            if section == "STATE":
                m = re.match(r"^([a-z_]+):[ \t]*(.*)$", line)
                if m:
                    state[m.group(1)] = m.group(2).strip()
            elif section == "TASKS":
                m = re.match(r"^### (T\d{3}): (.+?)\s*$", line)
                if m:
                    task = {"id": m.group(1), "title": m.group(2), "status": "TODO"}
                    tasks.append(task)
                elif task is not None:
                    s = re.match(r"^status:[ \t]*(\S+)", line)
                    if s:
                        task["status"] = s.group(1).upper()
        done = sum(1 for t in tasks if t["status"] == "DONE")
        out.append({"id": state.get("doc_id") or state.get("run_id") or p.stem,
                    "path": p.relative_to(root).as_posix(),
                    "title": title_of(text, p.stem).split(":", 1)[-1].strip(),
                    "status": state.get("status") or "UNKNOWN",
                    "current_task": state.get("current_task") or None,
                    "skeleton": state.get("skeleton") or None,
                    "tasks_total": len(tasks), "tasks_done": done, "tasks": tasks})
    return out


def sessions(root, cfg):
    out = []
    seen = set()
    by_file = set()

    def add(sid, date, kind, summary):
        key = (sid, date)
        if key in seen:
            return
        seen.add(key)
        out.append({"id": sid, "date": date, "type": kind, "summary": summary[:200]})

    tracker = root / cfg["tracker"]
    for line in read(tracker).splitlines():
        m = re.match(r"^\|\s*([^|]+?)\s*\|\s*([A-Z]+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|", line)
        if not m:
            continue
        sid, kind, stamp, summary, eventfile = (x.strip(" `") for x in m.groups())
        if not re.match(r"^(?:\d{8}-\d{6}-[A-Z]+(?:-\d{2})?|SS-\d{6})$", sid):
            continue
        date = DATE_RE.search(stamp)
        add(sid, date.group(0) if date else None, kind.lower(), clean(summary))
        if eventfile:
            by_file.add(Path(eventfile).name)

    folder = root / cfg["sessions_dir"]
    for p in sorted(folder.glob("*.md")) if folder.is_dir() else []:
        if p.name.lower().startswith("readme") or p.name in by_file:
            continue
        text = read(p)
        m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
        if not m:
            continue
        fields = {}
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                fields[k.strip().lower()] = clean(v)
        kind = (fields.get("type") or "event").lower()
        date = fields.get("time")
        if not date or date == "PENDING":
            date = None
        summary = fields.get("summary") or p.stem.replace("-", " ")
        add(fields.get("id") or p.stem, date, kind, summary)
    return out


def commits(root, limit):
    raw = git(root, "log", "-n", str(limit), "--pretty=format:%h\x1f%cI\x1f%s")
    out = []
    for line in raw.splitlines():
        parts = line.split("\x1f")
        if len(parts) == 3:
            out.append({"sha": parts[0], "date": parts[1], "subject": parts[2][:200]})
    return out


def project(root):
    url = git(root, "config", "--get", "remote.origin.url")
    m = re.search(r"github\.com[:/]+([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", url)
    name = title_of(read(root / "README.md"), root.resolve().name)
    return {"name": name, "repo": "%s/%s" % m.groups() if m else None,
            "branch": git(root, "rev-parse", "--abbrev-ref", "HEAD") or None}


def build(root, limit):
    cfg = read_config(root)
    base = (root / cfg["root"]).resolve() if cfg["root"] not in ("", ".") else root.resolve()
    root = root.resolve()
    sk = skeletons(root, base, cfg)
    totals = {"skeletons": len(sk),
              "done": sum(1 for s in sk if s["phase"] == "done"),
              "waiting": sum(1 for s in sk if s["phase"] == "waiting"),
              "draft": sum(1 for s in sk if s["phase"] == "draft")}
    ss = sessions(root, cfg)
    rn = runs(root, base, cfg)
    totals["sessions"] = len(ss)
    totals["runs"] = len(rn)
    totals["runs_active"] = sum(1 for r in rn if r["status"] in ("IN_PROGRESS", "BLOCKED"))
    return {"schema": SCHEMA,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "project": project(root), "totals": totals, "skeletons": sk,
            "runs": rn, "ideas": ideas(root, base, cfg), "sessions": ss,
            "commits": commits(root, limit)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".", help="repository root (default: current folder)")
    ap.add_argument("--out", default=".stageset/report.json", help="output path, relative to root")
    ap.add_argument("--stdout", action="store_true", help="print JSON instead of writing a file")
    ap.add_argument("--commits", type=int, default=40, help="how many git commits to include")
    a = ap.parse_args()
    root = Path(a.root)
    report = build(root, a.commits)
    text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if a.stdout:
        sys.stdout.write(text)
        return 0
    out = root / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    t = report["totals"]
    print("Wrote %s | skeletons %d (done %d, waiting %d, draft %d) | runs %d | sessions %d"
          % (out, t["skeletons"], t["done"], t["waiting"], t["draft"], t["runs"], t["sessions"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
