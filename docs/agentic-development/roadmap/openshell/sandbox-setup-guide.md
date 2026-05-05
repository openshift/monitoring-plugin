# Openshell Sandbox Setup Guide

> **Deprecated**: This guide documents the openshell-based sandbox approach, which was abandoned due to fundamental incompatibilities — Bun runtime crashes under seccomp/landlock restrictions and the TLS-terminating proxy breaks OpenShift API connections. See [sandbox-bun-crash-report.md](sandbox-bun-crash-report.md) for details. The production sandbox uses **Docker** instead — see [docs/agentic-development/setup/docker-sandbox-guide.md](../../setup/docker-sandbox-guide.md).

## Prerequisites

- `openshell` CLI installed and on PATH
- Docker running
- Gateway cluster running (`openshell gateway start` + verify with `openshell status`)
- Providers already configured (`openshell provider list` to verify — need `gcp-adc` and `my-github`)

## Step 1: Create the policy file

Create `sandbox-policy.yaml` in your project root:

```yaml
version: 1

network_policies:
  google_oauth:
    endpoints:
      - host: oauth2.googleapis.com
        port: 443
        enforcement: enforce
    binaries:
      - { path: /usr/bin/node }
      - { path: /usr/bin/bash }

  vertex_ai:
    endpoints:
      - host: us-east5-aiplatform.googleapis.com
        port: 443
        enforcement: enforce
    binaries:
      - { path: /usr/bin/node }
      - { path: /usr/bin/bash }

  github:
    endpoints:
      - host: github.com
        port: 443
        enforcement: enforce
    binaries:
      - { path: /usr/bin/git }

  npm_registry:
    endpoints:
      - host: registry.npmjs.org
        port: 443
        enforcement: enforce
    binaries:
      - { path: /usr/bin/node }
      - { path: /usr/bin/bash }
```

> **IMPORTANT:** Write this file using `cat > sandbox-policy.yaml << 'EOF' ... EOF` or a
> text editor. Do **NOT** copy-paste from rendered markdown — it can introduce invisible
> characters that break YAML parsing.

Notes on the policy:
- Binaries must match the actual paths inside the sandbox (`/usr/bin/node`, `/usr/bin/bash`), not host paths
- The base image bundles Bun, but it segfaults inside the sandbox due to seccomp/landlock restrictions — Claude must be installed via npm and runs on Node.js instead
- Add more entries as needed based on denied requests in logs (see Step 5)

## Step 2: Create the sandbox

Run from the project root directory:

```bash
openshell sandbox create --name my-project --provider gcp-adc --provider my-github --upload ".:/sandbox" --policy ./sandbox-policy.yaml
```

Notes:
- Do **NOT** add `-- claude` unless you have a claude provider set up (Vertex AI GCP auth uses the `gcp-adc` generic provider instead)
- If zsh prompts to correct anything, press `n`

## Step 3: Upload GCP credentials

The `gcp-adc` provider injects credentials via openshell's proxy placeholder system, which doesn't work for ADC file-based auth (the proxy can intercept HTTP headers but not local file reads). Upload the ADC file directly:

```bash
openshell sandbox upload my-project \
  "$HOME/.config/gcloud/application_default_credentials.json" \
  /sandbox/adc.json
```

> **Note:** `openshell sandbox upload` treats the destination as a directory and places the source file inside it. So the actual file path inside the sandbox will be `/sandbox/adc.json/application_default_credentials.json`.

> **Security tradeoff:** The ADC file contains a refresh token (not raw credentials). The agent inside the sandbox can read it. This is a known limitation — see the Troubleshooting section for alternatives.

## Step 4: Connect and install Claude via npm

```bash
openshell sandbox connect my-project
```

Inside the sandbox, install Claude Code via npm (the base image's Bun runtime crashes under sandbox restrictions):

```bash
npm install --prefix ~/claude-local @anthropic-ai/claude-code@latest
```

## Step 5: Start Claude with Vertex AI

Set the required environment variables and launch:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/sandbox/adc.json/application_default_credentials.json
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID=itpc-gcp-hcm-pe-eng-claude
export CLOUD_ML_REGION=us-east5
~/claude-local/node_modules/.bin/claude
```

> **Tip:** Add these exports to `~/.bashrc` inside the sandbox so they persist across sessions.

## Step 6: Monitor and iterate on policy

In a separate terminal on the host:

```bash
openshell logs my-project --tail --source sandbox
```

When you see denied requests, update the policy:

```bash
# Edit sandbox-policy.yaml to add the blocked host as a new entry...

# Push the update (hot-reloaded, no restart needed)
openshell policy set my-project --policy sandbox-policy.yaml --wait

# Verify
openshell policy list my-project
```

Only `network_policies` can be updated at runtime. Changes to `filesystem_policy`, `landlock`, or `process` require recreating the sandbox.

## Step 7: Upload/download files

```bash
# Upload a file to the running sandbox
openshell sandbox upload my-project ./local-file /sandbox/dest-path

# Download from sandbox
openshell sandbox download my-project /sandbox/some-file ./local-dest
```

> **Note:** Upload always creates a directory at the destination path and places the file inside. Plan your paths accordingly.

## Step 8: Clean up

```bash
openshell sandbox delete my-project
```

---

## Troubleshooting

### Bun segfault / "Illegal instruction (core dumped)"

The base image ships Bun 1.3.11 which crashes with `Segmentation fault at address 0xBBADBEEF` inside the sandbox due to seccomp/landlock restrictions. This affects all Bun versions tested (1.3.11, 1.3.13).

**Workaround:** Install Claude Code via npm so it runs on Node.js instead:

```bash
npm install --prefix ~/claude-local @anthropic-ai/claude-code@latest
~/claude-local/node_modules/.bin/claude
```

This requires `registry.npmjs.org` in the network policy with `/usr/bin/node` and `/usr/bin/bash` as allowed binaries.

### npm install permission denied (EACCES)

The sandbox runs as the `sandbox` user (non-root). Global npm install (`npm install -g`) fails because it can't write to `/usr/lib/node_modules/`.

**Fix:** Install to a user-writable prefix:

```bash
npm install --prefix ~/claude-local @anthropic-ai/claude-code@latest
```

### npm 403 Forbidden

The network policy allows the endpoint but the binary path is wrong. Check the logs:

```bash
openshell logs my-project --source sandbox
```

Look for `action=deny` lines — they show the actual binary path and ancestors. The policy must list the exact binary paths used inside the sandbox (e.g., `/usr/bin/node` not `/usr/local/bin/node`).

### ADC credential alternatives

**Option A (current):** Upload the ADC file directly. The agent can read the refresh token. This is the pragmatic choice — the token can only get short-lived access tokens scoped to your GCP project.

**Option B (more secure, not yet tested):** Generate a short-lived access token on the host and inject it as a provider:

```bash
TOKEN=$(gcloud auth application-default print-access-token)
openshell provider create --name vertex-token --type generic \
  --credential ANTHROPIC_VERTEX_AUTH_TOKEN="$TOKEN"
```

Note: Claude Code does not currently support a direct token env var for Vertex AI, so this requires additional work (e.g., an auth proxy with `CLAUDE_CODE_SKIP_VERTEX_AUTH=1`).

### ADC token expired

Re-authenticate on the host, then re-upload:

```bash
gcloud auth application-default login
openshell sandbox upload my-project \
  "$HOME/.config/gcloud/application_default_credentials.json" \
  /sandbox/adc.json
```

### DependenciesNotReady / pod stuck Pending

The sandbox image can't be pulled. Rebuild the cluster:

```bash
openshell sandbox delete my-project
openshell gateway destroy
openshell gateway start
```

Verify the image is available on your host:

```bash
docker pull ghcr.io/nvidia/openshell-community/sandboxes/base:latest
```

If that fails, check DNS/VPN/firewall.

### Policy parse errors

- `invalid type: string "1\nnetwork_policies"` — the YAML file has invisible characters or encoding issues. Recreate it with `cat > sandbox-policy.yaml << 'EOF' ... EOF`
- `expected struct NetworkPolicyRuleDef` — wrong YAML structure. `network_policies` must be a map of named policies, each with `endpoints` and `binaries` arrays
- Always validate structure: `version` is a top-level integer, `network_policies` is a sibling map at the same level

### Check cluster health

```bash
openshell status          # Cluster reachable?
openshell doctor logs     # Container-level logs
openshell sandbox list    # Existing sandboxes
openshell provider list   # Registered providers
```

### Sandbox won't start after failed attempt

Delete the old one first:

```bash
openshell sandbox delete <name>
```

Find the name with `openshell sandbox list` — it may have an auto-generated name like `smitten-mayfly` instead of `my-project`.
