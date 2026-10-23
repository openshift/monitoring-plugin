#!/usr/bin/env python3
"""Poll OpenShift CI (Prow) job status for a PR until completion.

Usage:
    python3 poll-ci-status.py <pr_number> [job_substring] [max_attempts] [interval_seconds]

Arguments:
    pr_number       GitHub PR number to poll
    job_substring   Substring to match in job name (default: e2e-incidents)
    max_attempts    Maximum polling attempts (default: 30)
    interval_seconds Sleep between polls in seconds (default: 300)

Output on completion:
    CI_COMPLETE state=SUCCESS url=<prow_url>
    CI_COMPLETE state=FAILURE url=<prow_url>
    CI_TIMEOUT (if max_attempts reached)

Requires: gh CLI authenticated with access to the repo.
"""

import subprocess
import json
import time
import sys


def poll(pr, job_substring="e2e-incidents", max_attempts=30, interval=300):
    for attempt in range(max_attempts):
        result = subprocess.run(
            ["gh", "pr", "checks", pr, "--repo", "openshift/monitoring-plugin", "--json", "name,state,link"],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print(
                f"gh pr checks failed (attempt {attempt + 1}/{max_attempts}): {result.stderr.strip()}",
                flush=True,
            )
            time.sleep(interval)
            continue

        try:
            checks = json.loads(result.stdout)
        except json.JSONDecodeError:
            print(
                f"Invalid JSON from gh pr checks (attempt {attempt + 1}/{max_attempts})",
                flush=True,
            )
            time.sleep(interval)
            continue

        matching = [c for c in checks if job_substring in c.get("name", "")]
        found = bool(matching)

        if found:
            completed = [c for c in matching if c["state"] in ("SUCCESS", "FAILURE")]
            if completed:
                check = completed[-1]
                print(f"CI_COMPLETE state={check['state']} url={check.get('link', '')}")
                return 0

            latest = matching[-1]
            print(
                f"CI_PENDING state={latest['state']}, attempt {attempt + 1}/{max_attempts}, sleeping {interval}s...",
                flush=True,
            )

        if not found:
            print(
                f"Job '{job_substring}' not found yet, attempt {attempt + 1}/{max_attempts}, sleeping {interval}s...",
                flush=True,
            )

        time.sleep(interval)

    print("CI_TIMEOUT")
    return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <pr_number> [job_substring] [max_attempts] [interval_seconds]")
        sys.exit(2)

    pr = sys.argv[1]
    job = sys.argv[2] if len(sys.argv) > 2 else "e2e-incidents"

    try:
        attempts = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        interval = int(sys.argv[4]) if len(sys.argv) > 4 else 300
    except ValueError:
        print("ERROR: max_attempts and interval_seconds must be positive integers")
        sys.exit(2)

    if attempts <= 0 or interval <= 0:
        print("ERROR: max_attempts and interval_seconds must be positive integers")
        sys.exit(2)

    sys.exit(poll(pr, job, attempts, interval))
