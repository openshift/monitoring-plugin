#!/usr/bin/env python3
"""Send Slack notifications for agentic test iteration loops.

Supports two modes based on environment variables:

Option A (Webhook — one-way):
    SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../..."

Option B (Bot with thread replies — two-way):
    SLACK_BOT_TOKEN="xoxb-..."
    SLACK_CHANNEL_ID="C0123456789"

If neither is set, prints the message to stdout and exits cleanly.

Usage:
    # Send a notification (both modes)
    python3 notify-slack.py send <event_type> <message> [options]

    # Wait for thread reply (Option B only)
    python3 notify-slack.py wait <message_ts> [--timeout 600]

Event types:
    fix_applied, ci_started, ci_complete, ci_failed,
    review_needed, iteration_done, flaky_found, blocked

Options:
    --pr <number>       PR number (adds link to message)
    --branch <name>     Branch name
    --url <ci_url>      CI run URL
    --thread-ts <ts>    Reply in a thread (Option B)
    --timeout <seconds> Review window timeout for 'wait' command (default: 600)
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error


EMOJI = {
    "fix_applied": ":wrench:",
    "ci_started": ":hourglass_flowing_sand:",
    "ci_complete": ":white_check_mark:",
    "ci_failed": ":x:",
    "review_needed": ":eyes:",
    "iteration_done": ":checkered_flag:",
    "flaky_found": ":warning:",
    "blocked": ":octagonal_sign:",
}


def build_blocks(event_type, message, pr=None, branch=None, url=None):
    """Build Slack Block Kit blocks for the notification."""
    emoji = EMOJI.get(event_type, ":robot_face:")

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{emoji} *Agent: {event_type.replace('_', ' ').title()}*",
            },
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": message},
        },
    ]

    context_parts = []
    if pr:
        context_parts.append(
            f"<https://github.com/openshift/monitoring-plugin/pull/{pr}|PR #{pr}>"
        )
    if branch:
        context_parts.append(f"Branch: `{branch}`")
    if url:
        context_parts.append(f"<{url}|CI Run>")

    if context_parts:
        blocks.append(
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": " | ".join(context_parts)}
                ],
            },
        )

    return blocks


def send_webhook(webhook_url, blocks):
    """Option A: Send via incoming webhook."""
    payload = json.dumps({"blocks": blocks}).encode("utf-8")

    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return {"ok": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        print(f"Webhook failed: HTTP {e.code} — {e.read().decode()}", file=sys.stderr)
        return {"ok": False, "error": str(e)}


def slack_api(token, method, payload):
    """Call a Slack Web API method."""
    url = f"https://slack.com/api/{method}"
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Slack API {method} failed: HTTP {e.code} — {body}", file=sys.stderr)
        return {"ok": False, "error": str(e)}


def send_bot(token, channel, blocks, thread_ts=None):
    """Option B: Send via bot token."""
    payload = {
        "channel": channel,
        "blocks": blocks,
    }
    if thread_ts:
        payload["thread_ts"] = thread_ts

    result = slack_api(token, "chat.postMessage", payload)

    if result.get("ok"):
        ts = result.get("ts", "")
        print(f"MESSAGE_TS={ts}")
        return {"ok": True, "ts": ts}
    else:
        print(f"Bot send failed: {result.get('error')}", file=sys.stderr)
        return {"ok": False, "error": result.get("error")}


def wait_for_reply(token, channel, message_ts, timeout=600, poll_interval=30):
    """Option B: Poll for thread replies within a review window.

    Returns the latest user reply text, or None if no reply within timeout.
    Output format:
        REPLY=<user's message text>
        NO_REPLY
    """
    # Get bot's own user ID to filter out its own messages
    auth_result = slack_api(token, "auth.test", {})
    bot_user_id = auth_result.get("user_id", "")

    deadline = time.time() + timeout
    seen_messages = set()

    # Seed with the original message to ignore it
    seen_messages.add(message_ts)

    print(f"Waiting up to {timeout}s for reply in thread {message_ts}...", flush=True)

    while time.time() < deadline:
        result = slack_api(
            token,
            "conversations.replies",
            {"channel": channel, "ts": message_ts},
        )

        if result.get("ok"):
            messages = result.get("messages", [])
            for msg in messages:
                msg_ts = msg.get("ts", "")
                user = msg.get("user", "")

                if msg_ts in seen_messages:
                    continue
                seen_messages.add(msg_ts)

                # Skip bot's own messages
                if user == bot_user_id:
                    continue

                # Found a user reply
                reply_text = msg.get("text", "")
                print(f"REPLY={reply_text}")
                return reply_text

        remaining = int(deadline - time.time())
        if remaining > 0:
            print(
                f"No reply yet, {remaining}s remaining...",
                file=sys.stderr,
                flush=True,
            )

        time.sleep(min(poll_interval, max(1, remaining)))

    print("NO_REPLY")
    return None


def cmd_send(args):
    """Handle the 'send' subcommand."""
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
    bot_token = os.environ.get("SLACK_BOT_TOKEN", "")
    channel_id = os.environ.get("SLACK_CHANNEL_ID", "")

    blocks = build_blocks(
        args.event_type, args.message, pr=args.pr, branch=args.branch, url=args.url
    )

    # Option B: Bot token takes priority (supports two-way)
    if bot_token and channel_id:
        result = send_bot(bot_token, channel_id, blocks, thread_ts=args.thread_ts)
        return 0 if result.get("ok") else 1

    # Option A: Webhook (one-way)
    if webhook_url:
        result = send_webhook(webhook_url, blocks)
        return 0 if result.get("ok") else 1

    # No Slack configured — print to stdout and exit cleanly
    emoji = EMOJI.get(args.event_type, "")
    print(f"[slack-skip] {emoji} {args.event_type}: {args.message}")
    return 0


def cmd_wait(args):
    """Handle the 'wait' subcommand."""
    bot_token = os.environ.get("SLACK_BOT_TOKEN", "")
    channel_id = os.environ.get("SLACK_CHANNEL_ID", "")

    if not bot_token or not channel_id:
        print(
            "NO_REPLY (Option B not configured — SLACK_BOT_TOKEN and SLACK_CHANNEL_ID required)"
        )
        return 0

    reply = wait_for_reply(
        bot_token, channel_id, args.message_ts, timeout=args.timeout
    )
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Slack notifications for agentic test iteration"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # 'send' subcommand
    send_parser = subparsers.add_parser("send", help="Send a notification")
    send_parser.add_argument(
        "event_type",
        choices=list(EMOJI.keys()),
        help="Event type",
    )
    send_parser.add_argument("message", help="Message text (Slack mrkdwn supported)")
    send_parser.add_argument("--pr", help="PR number")
    send_parser.add_argument("--branch", help="Branch name")
    send_parser.add_argument("--url", help="CI run URL")
    send_parser.add_argument(
        "--thread-ts", help="Thread timestamp to reply in (Option B)"
    )

    # 'wait' subcommand
    wait_parser = subparsers.add_parser(
        "wait", help="Wait for thread reply (Option B only)"
    )
    wait_parser.add_argument("message_ts", help="Message timestamp to watch")
    wait_parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Seconds to wait for reply (default: 600)",
    )

    args = parser.parse_args()

    if args.command == "send":
        return cmd_send(args)
    elif args.command == "wait":
        return cmd_wait(args)


if __name__ == "__main__":
    sys.exit(main())
