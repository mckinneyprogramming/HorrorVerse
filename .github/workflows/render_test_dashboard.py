import html
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


def add_case(cases, name, classname, status, raw_time, message):
    cases.append(
        {
            "name": name or "(unnamed)",
            "classname": short_class(classname),
            "status": status,
            "time": format_time(raw_time),
            "message": (message or "").strip()[:2000],
        }
    )


def parse_junit(path):
    root = ET.parse(path).getroot()
    cases = []

    def walk(node):
        if local(node.tag) == "testcase":
            status = "passed"
            message = ""
            for child in list(node):
                kind = local(child.tag)
                if kind in ("failure", "error"):
                    status = "failed"
                    message = (child.attrib.get("message") or "") + "\n" + (child.text or "")
                elif kind == "skipped" and status != "failed":
                    status = "skipped"
            add_case(
                cases,
                node.attrib.get("name"),
                node.attrib.get("classname"),
                status,
                node.attrib.get("time"),
                message,
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
        if status == "failed":
            for child in node.iter():
                if local(child.tag) == "Message" and (child.text or "").strip():
                    message = child.text
                    break
        add_case(cases, name, classname, status, node.attrib.get("duration"), message)
    return cases


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
        for path in sorted(folder.rglob("*")):
            if path.suffix.lower() in (".xml", ".trx"):
                cases.extend(load_file(path))
    rank = {"failed": 0, "skipped": 1, "passed": 2}
    cases.sort(key=lambda item: (item["classname"], rank[item["status"]], item["name"]))
    return {"key": key, "label": label, "cases": cases, "source_url": source_url, "source_name": source_name}


def count(cases, status):
    return sum(1 for item in cases if item["status"] == status)


def render_case(item):
    detail = ""
    if item["message"]:
        detail = f'<pre class="detail">{html.escape(item["message"])}</pre>'
    time = f'<span class="time">{html.escape(item["time"])}</span>' if item["time"] else ""
    return (
        f'<li class="case {item["status"]}">'
        f'<span class="mark">{item["status"]}</span>'
        f'<span class="name">{html.escape(item["name"])}</span>'
        f"{time}{detail}</li>"
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
        body = "".join(
            f'<section class="group" data-group><h3>{html.escape(title)}</h3><ul>{"".join(items)}</ul></section>'
            for title, items in groups
        )
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
    h3 {{ margin: 18px 0 8px; color: var(--muted); font-size: 14px; font-weight: 650; }}
    .tally {{ margin: 0; color: var(--muted); }}
    .tally b {{ color: var(--ink); }}
    .tally span {{ margin: 0 6px; }}
    .source {{ margin: 8px 0 0; }}
    .source a {{ color: var(--muted); }}
    .empty {{ color: var(--muted); }}
    ul {{ list-style: none; margin: 0; padding: 0; }}
    .case {{
      display: grid;
      grid-template-columns: 76px 1fr auto;
      gap: 8px 12px;
      align-items: baseline;
      padding: 8px 0;
      border-top: 1px solid var(--line);
    }}
    .mark {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }}
    .passed .mark {{ color: var(--pass); }}
    .failed .mark {{ color: var(--fail); }}
    .skipped .mark {{ color: var(--skip); }}
    .time {{ color: var(--muted); font-variant-numeric: tabular-nums; }}
    .detail {{ grid-column: 2 / -1; margin: 0; white-space: pre-wrap; color: #fecdd3; font: 13px/1.4 ui-monospace, monospace; }}
    @media (max-width: 640px) {{
      .case {{ grid-template-columns: 1fr auto; }}
      .mark {{ grid-column: 1 / -1; }}
    }}
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
        group.hidden = group.querySelector(".case:not([hidden])") === null;
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
