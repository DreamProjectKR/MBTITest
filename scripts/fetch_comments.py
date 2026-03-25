#!/usr/bin/env python3
"""Print PR metadata and comments for the current branch (gh-address-comments workflow)."""

from __future__ import annotations

import json
import subprocess
import sys


def run_gh(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        check=False,
    )


def main() -> None:
    r = run_gh(["pr", "view", "--json", "number,title,url,state,body"])
    if r.returncode != 0:
        msg = (r.stderr or r.stdout or "").strip()
        if "no pull requests found" in msg.lower():
            print(msg)
            sys.exit(0)
        sys.stderr.write(r.stderr or r.stdout or "gh pr view failed\n")
        sys.exit(r.returncode or 1)

    data = json.loads(r.stdout)
    print(f"PR #{data['number']}: {data['title']}")
    print(f"State: {data['state']}")
    print(data.get("url", ""))
    if data.get("body"):
        print("\n--- Body ---\n")
        print(data["body"])

    num = data["number"]
    print("\n--- Issue / PR conversation (gh pr view --comments) ---\n")
    r2 = subprocess.run(["gh", "pr", "view", str(num), "--comments"], check=False)
    if r2.returncode != 0:
        sys.exit(r2.returncode)

    print("\n--- Review threads (inline) ---\n")
    r3 = run_gh(
        [
            "api",
            f"repos/:owner/:repo/pulls/{num}/comments",
            "--paginate",
        ]
    )
    if r3.returncode == 0 and r3.stdout.strip():
        try:
            comments = json.loads(r3.stdout)
            for i, c in enumerate(comments, 1):
                path = c.get("path", "")
                line = c.get("line") or c.get("original_line")
                user = (c.get("user") or {}).get("login", "?")
                body = (c.get("body") or "").strip()
                loc = f"{path}:{line}" if path else "general"
                print(f"[{i}] {user} @ {loc}\n{body}\n---")
        except json.JSONDecodeError:
            print(r3.stdout)
    else:
        print("(no inline review comments or gh api failed)")
        if r3.stderr:
            sys.stderr.write(r3.stderr)


if __name__ == "__main__":
    main()
