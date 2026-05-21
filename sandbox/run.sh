#!/bin/bash
set -euo pipefail

# Docker-based sandbox for Claude Code with filesystem isolation
# See docs/agentic-development/architecture/security/docker-sandbox-blast-radius.md for security analysis

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="claude-sandbox"
CONTAINER_NAME="claude-sandbox-$$"
SANDBOXES_FILE="$PROJECT_ROOT/sandbox/sandboxes.json"

# --- Parse arguments ---
REUSE_DIR=""
SANDBOX_NAME=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --reuse)
            REUSE_DIR="$2"
            shift 2
            ;;
        --name)
            SANDBOX_NAME="$2"
            shift 2
            ;;
        --list)
            if [ -f "$SANDBOXES_FILE" ]; then
                echo "Available sandbox environments:"
                cat "$SANDBOXES_FILE" | python3 -m json.tool 2>/dev/null || cat "$SANDBOXES_FILE"
            else
                echo "No sandboxes registered yet."
            fi
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --reuse <path>   Reuse an existing sandbox directory instead of creating a new clone"
            echo "  --name <name>    Give this sandbox a name (used in sandboxes.json registry)"
            echo "  --list           List all registered sandbox environments"
            echo "  --help           Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run $0 --help for usage"
            exit 1
            ;;
    esac
done

# --- Configuration ---
# Override these with environment variables if needed
ADC_PATH="${GOOGLE_APPLICATION_CREDENTIALS:-$HOME/.config/gcloud/application_default_credentials.json}"
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/.kube/config}"
VERTEX_PROJECT="${ANTHROPIC_VERTEX_PROJECT_ID:-itpc-gcp-hcm-pe-eng-claude}"
VERTEX_REGION="${CLOUD_ML_REGION:-global}"

# --- Validation ---
if [ ! -f "$ADC_PATH" ]; then
    echo "ERROR: GCP ADC credentials not found at $ADC_PATH"
    echo "Run: gcloud auth application-default login"
    exit 1
fi

if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo "WARNING: kubeconfig not found at $KUBECONFIG_PATH — oc commands won't work"
    KUBECONFIG_MOUNT=""
else
    KUBECONFIG_MOUNT="-v ${KUBECONFIG_PATH}:/tmp/kubeconfig:ro"
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
    # Try to get token from gh CLI
    GITHUB_TOKEN=$(gh auth token 2>/dev/null || true)
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "WARNING: No GITHUB_TOKEN set and gh auth not configured — git push/PR won't work"
    fi
fi

# --- Detect DNS servers ---
# Reads real upstream nameservers from the host, skipping loopback stubs (systemd-resolved).
# Works on plain resolv.conf, systemd-resolved hosts, and inside OpenShift pods (CoreDNS IP).
DNS_SERVERS=$(grep '^nameserver' /etc/resolv.conf 2>/dev/null \
    | awk '$2 !~ /^127\./ { print $2 }') || true

# Fallback: ask systemd-resolved for the active upstream (covers the common Linux laptop case)
if [ -z "$DNS_SERVERS" ]; then
    DNS_SERVERS=$(resolvectl status 2>/dev/null \
        | awk '/Current DNS Server:/ { print $4; exit }') || true
fi

# --- Build image if needed ---
echo "Building sandbox image..."
docker build -t "$IMAGE_NAME" "$SCRIPT_DIR" --build-arg "HOST_UID=$(id -u)" --quiet

# --- Create or reuse sandbox directory ---
CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" symbolic-ref --short HEAD 2>/dev/null || true)
CURRENT_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || true)
if [ -z "$CURRENT_BRANCH" ] && [ -z "$CURRENT_COMMIT" ]; then
    echo "ERROR: Cannot determine current branch or commit — is this a git repository?"
    exit 1
fi

if [ -n "$REUSE_DIR" ]; then
    if [ ! -d "$REUSE_DIR/.git" ]; then
        echo "ERROR: $REUSE_DIR is not a git repository"
        exit 1
    fi
    SANDBOX_DIR="$REUSE_DIR"
    CURRENT_BRANCH=$(git -C "$SANDBOX_DIR" branch --show-current)
    echo "Reusing existing sandbox at $SANDBOX_DIR (branch: $CURRENT_BRANCH)"
else
    SANDBOX_DIR=$(mktemp -d /tmp/claude-sandbox-XXXXXX)
    REMOTE_URL=$(git -C "$PROJECT_ROOT" remote get-url origin 2>/dev/null || true)

    if [ -n "$CURRENT_BRANCH" ]; then
        echo "Cloning branch '$CURRENT_BRANCH' into $SANDBOX_DIR..."
        git clone --single-branch --branch "$CURRENT_BRANCH" --depth 50 "$PROJECT_ROOT" "$SANDBOX_DIR"
    else
        echo "Detached HEAD at $CURRENT_COMMIT — cloning and checking out commit..."
        git clone --depth 50 "$PROJECT_ROOT" "$SANDBOX_DIR"
        git -C "$SANDBOX_DIR" checkout "$CURRENT_COMMIT"
    fi

    # Set the remote to the actual upstream so push/pull work inside the container
    if [ -n "$REMOTE_URL" ]; then
        git -C "$SANDBOX_DIR" remote set-url origin "$REMOTE_URL"
    fi
fi

# --- Register sandbox ---
register_sandbox() {
    local dir="$1"
    local branch="$2"
    local name="${3:-}"
    local timestamp
    timestamp=$(date -Iseconds)

    if [ ! -f "$SANDBOXES_FILE" ]; then
        echo '[]' > "$SANDBOXES_FILE"
    fi

    # Remove stale entry for this path if it exists, then add new entry
    SANDBOXES_FILE="$SANDBOXES_FILE" \
    SANDBOX_PATH="$dir" \
    SANDBOX_BRANCH="$branch" \
    SANDBOX_NAME="$name" \
    SANDBOX_TIMESTAMP="$timestamp" \
    python3 -c '
import json, os

sandboxes_file = os.environ["SANDBOXES_FILE"]
entry = {
    "path": os.environ["SANDBOX_PATH"],
    "branch": os.environ["SANDBOX_BRANCH"],
    "name": os.environ["SANDBOX_NAME"],
    "created": os.environ["SANDBOX_TIMESTAMP"],
}

with open(sandboxes_file) as f:
    sandboxes = json.load(f)
sandboxes = [s for s in sandboxes if s["path"] != entry["path"]]
sandboxes.append(entry)
with open(sandboxes_file, "w") as f:
    json.dump(sandboxes, f, indent=2)
'
}

register_sandbox "$SANDBOX_DIR" "${CURRENT_BRANCH:-detached:${CURRENT_COMMIT:0:12}}" "$SANDBOX_NAME"

# --- Run the container ---
echo ""
echo "=== Sandbox Configuration ==="
echo "  Project:     $PROJECT_ROOT"
echo "  Branch:      ${CURRENT_BRANCH:-detached at ${CURRENT_COMMIT:0:12}}"
echo "  Sandbox:     $SANDBOX_DIR"
echo "  Vertex AI:   $VERTEX_PROJECT ($VERTEX_REGION)"
echo "  GitHub:      $([ -n "${GITHUB_TOKEN:-}" ] && echo 'token set' || echo 'NOT SET')"
echo "  Kubeconfig:  $([ -n "${KUBECONFIG_MOUNT:-}" ] && echo 'mounted (read-only)' || echo 'NOT SET')"
echo "  DNS:         $([ -n "${DNS_SERVERS:-}" ] && echo "$DNS_SERVERS" || echo '8.8.8.8 (Docker default — may fail on corporate networks)')"
echo ""
echo "  Filesystem:  Only worktree is writable. Host is isolated."
echo "  See docs/agentic-development/architecture/security/docker-sandbox-blast-radius.md for full security analysis."
echo "=============================="
echo ""

DOCKER_ARGS=(
    docker run -it --rm
    --name "$CONTAINER_NAME"
)

for dns in $DNS_SERVERS; do
    DOCKER_ARGS+=(--dns "$dns")
done

DOCKER_ARGS+=(
    -v "${SANDBOX_DIR}:/sandbox"
    -v "${ADC_PATH}:/tmp/adc.json:ro"
)

if [ -n "${KUBECONFIG_MOUNT:-}" ]; then
    DOCKER_ARGS+=(-v "${KUBECONFIG_PATH}:/tmp/kubeconfig")
    DOCKER_ARGS+=(-e "KUBECONFIG=/tmp/kubeconfig")
fi

DOCKER_ARGS+=(
    -e "GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc.json"
    -e "CLAUDE_CODE_USE_VERTEX=1"
    -e "ANTHROPIC_VERTEX_PROJECT_ID=$VERTEX_PROJECT"
    -e "CLOUD_ML_REGION=$VERTEX_REGION"
    -e "GITHUB_TOKEN=${GITHUB_TOKEN:-}"
    "$IMAGE_NAME"
)

"${DOCKER_ARGS[@]}"
