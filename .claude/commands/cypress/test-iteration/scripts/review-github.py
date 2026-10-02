#!/usr/bin/env python3
"""GitHub PR comment-based review flow for agentic test iteration.

Posts fix details as PR comments and polls for author replies within a
timed review window. Designed to work alongside Slack webhook notifications
(one-way) — GitHub PR comments provide the two-way interaction channel.

Usage:
    # Post a review comment on a PR
    python3 review-github.py post <pr_number> <message> [--repo owner/repo]

    # Wait for author reply within a review window
    python3 review-github.py wait <pr_number> <since_timestamp> [--timeout 600] [--repo owner/repo]

Output formats:
    post:  COMMENT_ID=<id>  COMMENT_TIME=<iso_timestamp>
    wait:  REPLY=<text>     (author replied)
           NO_REPLY         (timeout reached, no author reply)

Requires: gh CLI authenticated with comment access to the target repo.

Security: Author filtering is enforced deterministically in code —
the PR author's login is fetched via API and only comments from that
user are considered. This is not instruction-based filtering.
"""

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone


DEFAULT_REPO = "openshift/monitoring-plugin"
MAGIC_PREFIX = "/agent"


def gh_api(endpoint, method="GET", body=None, repo=None):
    """Call GitHub API via gh CLI."""
    cmd = ["gh", "api"]
    if repo:
        endpoint = endpoint.replace("{repo}", repo)
    if method != "GET":
        cmd.extend(["--method", method])
    if body:
        for key, value in body.items():
            cmd.extend(["-f", f"{key}={value}"])
    cmd.append(endpoint)

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"gh api failed: {result.stderr.strip()}", file=sys.stderr)
        return None

    if not result.stdout.strip():
        return {}

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Invalid JSON from gh api: {result.stdout[:200]}", file=sys.stderr)
        return None


def get_pr_author(pr, repo):
    """Fetch the PR author's login."""
    data = gh_api(f"repos/{repo}/pulls/{pr}")
    if data and "user" in data:
        return data["user"]["login"]
    return None


def post_comment(pr, message, repo):
    """Post a comment on a PR. Returns (comment_id, created_at)."""
    data = gh_api(
        f"repos/{repo}/issues/{pr}/comments",
        method="POST",
        body={"body": message},
    )
    if data and "id" in data:
        comment_id = data["id"]
        created_at = data.get("created_at", "")
        print(f"COMMENT_ID={comment_id}")
        print(f"COMMENT_TIME={created_at}")
        return comment_id, created_at

    print("Failed to post comment", file=sys.stderr)
    return None, None


def wait_for_author_reply(pr, since_timestamp, repo, timeout=600, poll_interval=30):
    """Poll PR comments for a reply from the PR author.

    Only considers comments that:
    1. Were posted AFTER since_timestamp (time-scoped)
    2. Were authored by the PR author (deterministic .user.login check)
    3. Optionally start with the magic prefix /agent (if present, stripped from reply)

    Args:
        pr: PR number
        since_timestamp: ISO 8601 timestamp — only comments after this are considered
        repo: owner/repo string
        timeout: seconds to wait before giving up
        poll_interval: seconds between polls

    Returns:
        Reply text if found, None otherwise.
    """
    # Fetch PR author login — deterministic, code-enforced filter
    pr_author = get_pr_author(pr, repo)
    if not pr_author:
        print("Could not determine PR author. Proceeding without review.", file=sys.stderr)
        print("NO_REPLY")
        return None

    print(f"Waiting up to {timeout}s for reply from @{pr_author} on PR #{pr}...", flush=True)

    deadline = time.time() + timeout
    seen_ids = set()

    while time.time() < deadline:
        # Fetch comments created after since_timestamp
        comments = gh_api(
            f"repos/{repo}/issues/{pr}/comments?since={since_timestamp}&per_page=50"
        )

        if comments is None:
            remaining = int(deadline - time.time())
            if remaining > 0:
                print(f"API error, retrying in {poll_interval}s ({remaining}s remaining)...",
                      file=sys.stderr, flush=True)
                time.sleep(min(poll_interval, max(1, remaining)))
            continue

        for comment in comments:
            comment_id = comment.get("id")
            if comment_id in seen_ids:
                continue
            seen_ids.add(comment_id)

            # Deterministic author filter — code-enforced, not instruction-based
            commenter = comment.get("user", {}).get("login", "")
            if commenter != pr_author:
                continue

            body = comment.get("body", "").strip()

            # If magic prefix is used, strip it; otherwise accept any author comment
            if body.startswith(MAGIC_PREFIX):
                body = body[len(MAGIC_PREFIX):].strip()

            if body:
                print(f"REPLY={body}")
                return body

        remaining = int(deadline - time.time())
        if remaining > 0:
            print(
                f"No reply yet from @{pr_author}, {remaining}s remaining...",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(min(poll_interval, max(1, remaining)))

    print("NO_REPLY")
    return None


def format_fix_comment(message):
    """Wrap the agent's message in a standard comment format."""
    return (
        "### Agent: Fix Applied\n\n"
        f"{message}\n\n"
        "---\n"
        f"*Reply to this comment (or prefix with `{MAGIC_PREFIX}`) to provide feedback. "
        "The agent will incorporate your input before pushing, or proceed automatically "
        "after the review window expires.*"
    )


def cmd_post(args):
    """Handle the 'post' subcommand."""
    formatted = format_fix_comment(args.message)
    comment_id, created_at = post_comment(args.pr, formatted, args.repo)
    return 0 if comment_id else 1


def cmd_wait(args):
    """Handle the 'wait' subcommand."""
    wait_for_author_reply(
        args.pr, args.since, args.repo, timeout=args.timeout
    )
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="GitHub PR comment-based review for agentic test iteration"
    )
    parser.add_argument(
        "--repo", default=DEFAULT_REPO,
        help=f"GitHub repo (default: {DEFAULT_REPO})"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # 'post' subcommand
    post_parser = subparsers.add_parser("post", help="Post a review comment on a PR")
    post_parser.add_argument("pr", help="PR number")
    post_parser.add_argument("message", help="Comment body (markdown supported)")

    # 'wait' subcommand
    wait_parser = subparsers.add_parser(
        "wait", help="Wait for author reply on a PR"
    )
    wait_parser.add_argument("pr", help="PR number")
    wait_parser.add_argument("since", help="ISO 8601 timestamp — only consider comments after this")
    wait_parser.add_argument(
        "--timeout", type=int, default=600,
        help="Seconds to wait for reply (default: 600)"
    )

    args = parser.parse_args()

    if args.command == "post":
        return cmd_post(args)
    elif args.command == "wait":
        return cmd_wait(args)


if __name__ == "__main__":
    sys.exit(main())
