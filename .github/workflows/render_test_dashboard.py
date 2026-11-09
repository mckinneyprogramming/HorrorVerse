import html
import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SUITES = (
    ("api-integration-tests", "API and integration"),
    ("web-unit-tests", "Web unit"),
    ("browser-journeys", "Browser journeys"),
    ("deploy-smoke", "Deploy smoke"),
)


def local(tag):
    return tag.rsplit("}", 1)[-1]


def format_time(raw):
    raw = (raw or "").strip()
    if not raw:
        return ""
    try:
        if ":" in raw:
            parts = [float(part) for part in raw.split(":")]
            seconds = 0
            for part in parts:
                seconds = seconds * 60 + part
        else:
            seconds = float(raw)
    except ValueError:
        return raw
    if seconds < 1:
        return f"{seconds * 1000:.0f} ms"
    return f"{seconds:.1f} s"


def short_class(name):
    name = name or ""
    prefix = "HorrorTracker.Tests."
    if name.startswith(prefix):
        return name[len(prefix) :]
    return name or "Tests"


def lines_to_steps(text):
    steps = []
    for line in (text or "").splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        steps.append({"title": cleaned[:500], "time": "", "status": "", "steps": []})
        if len(steps) >= 40:
            break
    return steps


def add_case(cases, name, classname, status, raw_time, message, steps=None):
    cases.append(
        {
            "name": name or "(unnamed)",
            "classname": short_class(classname),
            "status": status,
            "time": format_time(raw_time),
            "message": (message or "").strip()[:2000],
            "steps": steps or [],
        }
    )


def parse_junit(path):
    root = ET.parse(path).getroot()
    cases = []

    def walk(node):
        if local(node.tag) == "testcase":
            status = "passed"
            message = ""
            output = []
            for child in list(node):
                kind = local(child.tag)
                if kind in ("failure", "error"):
                    status = "failed"
                    message = (child.attrib.get("message") or "") + "\n" + (child.text or "")
                elif kind == "skipped" and status != "failed":
                    status = "skipped"
                elif kind in ("system-out", "system-err"):
                    output.extend(lines_to_steps(child.text))
            add_case(
                cases,
                node.attrib.get("name"),
                node.attrib.get("classname"),
                status,
                node.attrib.get("time"),
                message,
                output[:40],
            )
            return
        for child in list(node):
            walk(child)

    walk(root)
    return cases


def parse_trx(path):
    root = ET.parse(path).getroot()
    cases = []
    for node in root.iter():
        if local(node.tag) != "UnitTestResult":
            continue
        outcome = node.attrib.get("outcome", "")
        if outcome == "Passed":
            status = "passed"
        elif outcome in ("NotExecuted", "NotRunnable"):
            status = "skipped"
        else:
            status = "failed"
        full = node.attrib.get("testName") or "(unnamed)"
        classname, separator, name = full.rpartition(".")
        if not separator:
            classname, name = "", full
        message = ""
        output = []
        for child in node.iter():
            kind = local(child.tag)
            if status == "failed" and kind == "Message" and (child.text or "").strip() and not message:
                message = child.text
            elif kind == "StdOut":
                output.extend(lines_to_steps(child.text))
        add_case(cases, name, classname, status, node.attrib.get("duration"), message, output[:40])
    return cases


def convert_playwright_step(step):
    error = step.get("error") if isinstance(step, dict) else None
    title = (step.get("title") if isinstance(step, dict) else "") or "Step"
    if isinstance(error, dict) and error.get("message"):
        title = f"{title}: {error['message']}"
    duration = step.get("duration") if isinstance(step, dict) else None
    time = format_time(str(float(duration) / 1000)) if isinstance(duration, (int, float)) else ""
    children = [
        convert_playwright_step(child)
        for child in (step.get("steps") or [])
        if isinstance(child, dict) and (child.get("title") or child.get("steps"))
    ]
    return {"title": title[:500], "time": time, "status": "failed" if error else "", "steps": children}


def playwright_specs(report):
    found = []

    def walk(suite, file_name):
        current = suite.get("file") or file_name
        for spec in suite.get("specs") or []:
            results = []
            for test in spec.get("tests") or []:
                results.extend(test.get("results") or [])
            chosen = next((item for item in reversed(results) if item.get("steps")), results[-1] if results else {})
            steps = [
                convert_playwright_step(step)
                for step in (chosen.get("steps") or [])
                if isinstance(step, dict) and step.get("title")
            ]
            if steps:
                found.append({"title": spec.get("title") or "", "file": current or "", "steps": steps})
        for child in suite.get("suites") or []:
            if isinstance(child, dict):
                walk(child, current)

    for suite in report.get("suites") or []:
        if isinstance(suite, dict):
            walk(suite, "")
    return found


def merge_playwright_steps(cases, report):
    specs = playwright_specs(report)
    for case in cases:
        matches = [spec for spec in specs if spec["title"] == case["name"]]
        if not matches:
            continue
        chosen = matches[0]
        for spec in matches:
            file_name = spec["file"].replace("\\", "/")
            if file_name and file_name in case["classname"].replace("\\", "/"):
                chosen = spec
                break
        case["steps"] = chosen["steps"]


def load_file(path):
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as error:
        raise SystemExit(f"Could not read {path}: {error}") from error
    kind = local(root.tag)
    if kind in ("testsuite", "testsuites"):
        return parse_junit(path)
    if kind == "TestRun":
        return parse_trx(path)
    return []


def load_suite(data_dir, key, label):
    folder = data_dir / key
    cases = []
    source_url = ""
    source_name = ""
    if folder.is_dir():
        source = folder / "source.txt"
        if source.is_file():
            lines = source.read_text(encoding="utf-8-sig").splitlines()
            source_url = lines[0].strip() if lines else ""
            source_name = lines[1].strip() if len(lines) > 1 else ""
        reports = []
        for path in sorted(folder.rglob("*")):
            if path.suffix.lower() in (".xml", ".trx"):
                cases.extend(load_file(path))
            elif path.suffix.lower() == ".json":
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                except json.JSONDecodeError as error:
                    raise SystemExit(f"Could not read {path}: {error}") from error
                if isinstance(payload, dict) and "suites" in payload:
                    reports.append(payload)
        for report in reports:
            merge_playwright_steps(cases, report)
    rank = {"failed": 0, "skipped": 1, "passed": 2}
    cases.sort(key=lambda item: (item["classname"], rank[item["status"]], item["name"]))
    return {"key": key, "label": label, "cases": cases, "source_url": source_url, "source_name": source_name}


def count(cases, status):
    return sum(1 for item in cases if item["status"] == status)


def render_step_list(steps, placeholder):
    if not steps:
        return '<p class="none">No steps were recorded for this test.</p>' if placeholder else ""
    items = []
    for step in steps:
        status = step.get("status") or ""
        klass = f' class="step-{status}"' if status else ""
        time = f'<span class="time">{html.escape(step["time"])}</span>' if step.get("time") else ""
        nested = render_step_list(step.get("steps") or [], False)
        items.append(f"<li{klass}><span>{html.escape(step['title'])}</span>{time}{nested}</li>")
    return f'<ol class="steps">{"".join(items)}</ol>'


def render_case(item):
    detail = f'<pre class="detail">{html.escape(item["message"])}</pre>' if item["message"] else ""
    time = f'<span class="time">{html.escape(item["time"])}</span>' if item["time"] else ""
    opened = " open" if item["status"] == "failed" else ""
    return (
        f'<details class="case {item["status"]}"{opened}>'
        f'<summary><span class="row"><span class="mark">{item["status"]}</span>'
        f'<span class="name">{html.escape(item["name"])}</span>{time}</span></summary>'
        f"{detail}{render_step_list(item.get('steps') or [], True)}</details>"
    )


def render_suite(suite):
    passed = count(suite["cases"], "passed")
    failed = count(suite["cases"], "failed")
    skipped = count(suite["cases"], "skipped")
    source = ""
    if suite["source_url"].startswith("https://") and suite["source_name"]:
        source = (
            f'<p class="source"><a href="{html.escape(suite["source_url"], quote=True)}">'
            f'{html.escape(suite["source_name"])}</a></p>'
        )
    if not suite["cases"]:
        body = '<p class="empty">Waiting for the next run.</p>'
    else:
        groups = []
        current = None
        rows = []
        for item in suite["cases"]:
            if item["classname"] != current:
                if rows:
                    groups.append((current, rows))
                current = item["classname"]
                rows = []
            rows.append(render_case(item))
        if rows:
            groups.append((current, rows))
        rendered = []
        for title, items in groups:
            has_failure = any('class="case failed"' in item for item in items)
            opened = " open" if has_failure else ""
            rendered.append(
                f'<details class="group" data-group{opened}><summary><span class="row"><span class="group-title">{html.escape(title)}</span>'
                f'<span class="count">{len(items)}</span></span></summary><div class="tests">{"".join(items)}</div></details>'
            )
        body = "".join(rendered)
    return (
        f'<article class="suite" id="{html.escape(suite["key"], quote=True)}">'
        f"<header><h2>{html.escape(suite['label'])}</h2>"
        f'<p class="tally"><b>{passed}</b> passed<span>·</span><b>{failed}</b> failed<span>·</span><b>{skipped}</b> skipped</p>'
        f"{source}</header>{body}</article>"
    )


def render(suites, updated):
    cases = [item for suite in suites for item in suite["cases"]]
    passed = count(cases, "passed")
    failed = count(cases, "failed")
    skipped = count(cases, "skipped")
    nav = "".join(
        f'<a href="#{html.escape(suite["key"], quote=True)}">{html.escape(suite["label"])}</a>' for suite in suites
    )
    cards = "".join(render_suite(suite) for suite in suites)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HorrorVerse tests</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #101114;
      --card: #1a1c22;
      --ink: #f4f1ea;
      --muted: #a8a29e;
      --line: #2e323c;
      --pass: #4ade80;
      --fail: #fb7185;
      --skip: #fbbf24;
    }}
    * {{ box-sizing: border-box; }}
    [hidden] {{ display: none !important; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 16px/1.45 "Segoe UI", system-ui, sans-serif;
    }}
    .wrap {{ width: min(1080px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 64px; }}
    .top {{ display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; flex-wrap: wrap; }}
    .eyebrow {{ margin: 0; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; }}
    h1 {{ margin: 4px 0; font-size: 40px; line-height: 1; }}
    .updated {{ margin: 0; color: var(--muted); }}
    .totals {{ display: flex; gap: 8px; flex-wrap: wrap; }}
    .totals span, .tally {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 12px;
    }}
    .totals .passed b {{ color: var(--pass); }}
    .totals .failed b {{ color: var(--fail); }}
    .totals .skipped b {{ color: var(--skip); }}
    .tools {{
      position: sticky;
      top: 0;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      margin: 24px 0;
      padding: 12px 0;
      background: color-mix(in srgb, var(--bg) 92%, transparent);
    }}
    .nav {{ display: flex; gap: 12px; flex-wrap: wrap; }}
    .nav a {{ color: var(--ink); }}
    label {{ display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 13px; }}
    input, button {{
      font: inherit;
      color: var(--ink);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
    }}
    input {{ min-width: min(320px, 100%); padding: 8px 10px; }}
    .filters {{ display: flex; gap: 8px; }}
    button {{ padding: 8px 12px; cursor: pointer; }}
    button[aria-pressed="true"] {{ border-color: var(--ink); }}
    .suite {{ background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin: 0 0 16px; }}
    .suite header {{ display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: baseline; }}
    h2 {{ margin: 0; font-size: 22px; }}
    details.group, details.case {{ border-top: 1px solid var(--line); }}
    summary {{
      display: list-item;
      cursor: pointer;
      list-style: none;
    }}
    summary::-webkit-details-marker {{ display: none; }}
    summary::marker {{ content: ""; }}
    summary .row, summary .row * {{
      pointer-events: none;
    }}
    summary .row {{
      display: flex;
      gap: 12px;
      align-items: baseline;
      padding: 10px 0 10px 1.2em;
      position: relative;
    }}
    summary .row::before {{
      content: "▸";
      position: absolute;
      left: 0;
      color: var(--muted);
    }}
    details[open] > summary .row::before {{ content: "▾"; }}
    .group-title {{ color: var(--muted); font-size: 14px; font-weight: 650; }}
    .count {{ margin-left: auto; color: var(--muted); font-size: 13px; }}
    .tally {{ margin: 0; color: var(--muted); }}
    .tally b {{ color: var(--ink); }}
    .tally span {{ margin: 0 6px; }}
    .source {{ margin: 8px 0 0; }}
    .source a {{ color: var(--muted); }}
    .empty {{ color: var(--muted); }}
    .tests {{ padding-left: 18px; }}
    .case summary .name {{ flex: 1; }}
    .mark {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }}
    .passed > summary .mark {{ color: var(--pass); }}
    .failed > summary .mark {{ color: var(--fail); }}
    .skipped > summary .mark {{ color: var(--skip); }}
    .time {{ color: var(--muted); font-variant-numeric: tabular-nums; }}
    .steps {{ margin: 0 0 12px 1.4em; padding: 0; }}
    .steps li {{ margin: 4px 0; }}
    .step-failed > span {{ color: var(--fail); }}
    .none {{ margin: 0 0 12px 1.4em; color: var(--muted); }}
    .detail {{ margin: 0 0 12px 1.4em; white-space: pre-wrap; color: #fecdd3; font: 13px/1.4 ui-monospace, monospace; }}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div>
        <p class="eyebrow">HorrorVerse</p>
        <h1>Tests</h1>
        <p class="updated">Updated {html.escape(updated)}</p>
      </div>
      <div class="totals">
        <span class="passed"><b>{passed}</b> passed</span>
        <span class="failed"><b>{failed}</b> failed</span>
        <span class="skipped"><b>{skipped}</b> skipped</span>
      </div>
    </header>
    <div class="tools">
      <nav class="nav">{nav}</nav>
      <label>Search<input id="q" type="search" placeholder="Test name"></label>
      <div class="filters" role="group" aria-label="Status">
        <button type="button" data-status="all" aria-pressed="true">All</button>
        <button type="button" data-status="failed" aria-pressed="false">Failed</button>
        <button type="button" data-status="passed" aria-pressed="false">Passed</button>
        <button type="button" data-status="skipped" aria-pressed="false">Skipped</button>
      </div>
    </div>
    {cards}
  </div>
  <script>
    const state = {{ query: "", status: "all" }};
    const search = document.querySelector("#q");
    function apply() {{
      const needle = state.query.trim().toLowerCase();
      document.querySelectorAll(".case").forEach((row) => {{
        const statusOk = state.status === "all" || row.classList.contains(state.status);
        const textOk = needle === "" || row.textContent.toLowerCase().includes(needle);
        row.hidden = !(statusOk && textOk);
      }});
      document.querySelectorAll("[data-group]").forEach((group) => {{
        const visible = group.querySelector(".case:not([hidden])");
        group.hidden = visible === null;
        if (visible && (needle !== "" || state.status !== "all")) group.open = true;
      }});
    }}
    search.addEventListener("input", () => {{
      state.query = search.value;
      apply();
    }});
    document.querySelectorAll("[data-status]").forEach((button) => {{
      button.addEventListener("click", () => {{
        state.status = button.dataset.status;
        document.querySelectorAll("[data-status]").forEach((item) => {{
          item.setAttribute("aria-pressed", item === button ? "true" : "false");
        }});
        apply();
      }});
    }});
  </script>
</body>
</html>
"""


def display_time(value):
    text = (value or "").strip()
    if text.endswith("Z"):
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return parsed.strftime("%Y-%m-%d %H:%M UTC")
        except ValueError:
            return text
    return text or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def main():
    data_dir = Path(sys.argv[1])
    output = Path(sys.argv[2])
    updated = display_time(os.environ.get("DASHBOARD_UPDATED"))
    suites = [load_suite(data_dir, key, label) for key, label in SUITES]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render(suites, updated), encoding="utf-8")


if __name__ == "__main__":
    main()
