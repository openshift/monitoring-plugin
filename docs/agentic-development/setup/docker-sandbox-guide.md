# Docker Sandbox Setup Guide

Run Claude Code in an isolated Docker container with filesystem isolation, scoped credentials, and full Cypress test tooling.

## Prerequisites

- **Docker** installed and running
- **GCP Application Default Credentials** — for Vertex AI access to Claude
  ```bash
  gcloud auth application-default login
  ```
- **kubeconfig** — for `oc` commands against an OpenShift cluster (optional)
- **GitHub token** — for pushing code and creating PRs (optional, auto-detected from `gh auth`)

## Quick Start

From the project root:

```bash
./sandbox/run.sh
```

This builds the Docker image, creates an isolated git clone of the current branch, mounts credentials read-only, and drops you into a Claude Code session.

## What Happens Under the Hood

### 1. Image Build

The `sandbox/Dockerfile` builds a `node:22-bookworm` image with:
- Cypress system dependencies (Xvfb, GTK, NSS, etc.)
- `gh` CLI (GitHub operations)
- `oc` + `kubectl` CLI (OpenShift operations)
- Claude Code installed globally via npm
- A `sandbox` user with UID matching your host user (for file permission compatibility)
- Vertex AI environment pre-configured (project, region, ADC path)
- Claude defaults: Sonnet 4.6, 1M token context

### 2. Repository Isolation

The script creates a **shallow clone** of your current branch into a temp directory:

```bash
git clone --single-branch --branch "$CURRENT_BRANCH" --depth 50 "$PROJECT_ROOT" "$SANDBOX_DIR"
```

This means:
- The agent works on a copy, not your working tree
- Your uncommitted changes, stashes, and other branches are not visible
- The remote URL is rewritten to the actual upstream so `git push` works from inside the container
- The temp directory is **preserved after exit** — inspect it to review changes, cherry-pick commits, or investigate what the agent did

### 3. Credential Mounting

| Credential | Container Path | Mode | Source |
|---|---|---|---|
| GCP ADC | `/tmp/adc.json` | read-only | `$GOOGLE_APPLICATION_CREDENTIALS` or `~/.config/gcloud/application_default_credentials.json` |
| Kubeconfig | `/tmp/kubeconfig` | read-only | `$KUBECONFIG` or `~/.kube/config` |
| GitHub token | `$GITHUB_TOKEN` env var | env | `$GITHUB_TOKEN` or `gh auth token` |

Credentials are mounted **read-only** — the agent cannot modify or delete them. Your SSH keys, GPG keys, Docker credentials, and other config files are **not mounted** and are invisible to the agent.

See [docker-sandbox-blast-radius.md](../architecture/security/docker-sandbox-blast-radius.md) for a full security analysis.

### 4. Container Launch

The container runs interactively with:
- The cloned worktree mounted at `/sandbox` (read-write)
- All Vertex AI environment variables injected
- Claude Code started with `--dangerously-skip-permissions` (the container itself is the isolation boundary)

## Configuration

Override defaults with environment variables before running:

```bash
# Use a different GCP project
export ANTHROPIC_VERTEX_PROJECT_ID=my-other-project
export CLOUD_ML_REGION=europe-west1

# Use a specific kubeconfig
export KUBECONFIG=$HOME/.kube/staging-config

# Use a specific GitHub token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

./sandbox/run.sh
```

## Scoping Credentials (Recommended)

### GitHub: Fine-Grained PAT

Create a [fine-grained Personal Access Token](https://github.com/settings/tokens?type=beta) scoped to this repository only:
- `contents: write` — push commits
- `pull_requests: write` — create PRs
- `metadata: read` — required baseline

Do NOT grant `admin`, `actions`, `secrets`, or `environments`.

### OpenShift: Scoped Service Account

For non-ephemeral clusters, use a scoped service account instead of `kubeadmin`:

```bash
oc create serviceaccount claude-agent -n <namespace>
oc adm policy add-role-to-user view system:serviceaccount:<ns>:claude-agent -n <ns>
```

Export a kubeconfig for that SA and pass it to the sandbox.

## Troubleshooting

### ADC token expired

```
ERROR: GCP ADC credentials not found at ...
```

Re-authenticate:

```bash
gcloud auth application-default login
```

### kubeconfig not found

The script prints a warning but continues — `oc` commands inside the container won't work. Set `KUBECONFIG` to the correct path if it's not in the default location.

### GitHub token not set

The script tries `gh auth token` as a fallback. If that also fails, `git push` and `gh pr create` won't work inside the container. Either:
- Run `gh auth login` on the host, or
- Set `GITHUB_TOKEN` explicitly

### File permission issues

The Dockerfile creates a `sandbox` user with your host UID (`id -u`). If files inside the container are owned by a different user, rebuild the image:

```bash
docker build -t claude-sandbox sandbox/ --build-arg "HOST_UID=$(id -u)"
```

### Retrieving changes after a session

The sandbox worktree is preserved at `/tmp/claude-sandbox-*` after the container exits. To inspect or use the agent's work:

```bash
# Find the sandbox directory
ls -dt /tmp/claude-sandbox-*

# Review what the agent did
cd /tmp/claude-sandbox-XXXXXX
git log --oneline
git diff

# Cherry-pick commits into your working tree
cd /path/to/your/repo
git remote add sandbox /tmp/claude-sandbox-XXXXXX
git cherry-pick <commit-sha>
git remote remove sandbox

# Or apply uncommitted changes as a patch
cd /tmp/claude-sandbox-XXXXXX
git diff > /tmp/agent-changes.patch
cd /path/to/your/repo
git apply /tmp/agent-changes.patch
```

### Cleaning up old sandboxes

Sandbox directories accumulate over time. Clean them up when no longer needed:

```bash
ls -dt /tmp/claude-sandbox-*
rm -rf /tmp/claude-sandbox-*
```

## Historical Note

An earlier approach used [openshell](../roadmap/openshell/) for sandboxing but was abandoned due to Bun segfaults under seccomp/landlock restrictions and TLS proxy incompatibilities with OpenShift API connections. See the [openshell sandbox docs](../roadmap/openshell/) for details.
