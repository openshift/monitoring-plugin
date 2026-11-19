# Ensure Environment

Layer 1 primitive: prepare the full test session — npm dependencies, writable kubeconfig, required connection vars, and setup profile. **Call once per session**, before the first `run-suite`. Do not call again inside iteration loops.

## Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `setup-profile` | no | One of the five intent profiles below. Prompts if absent and not already configured. |

## Steps

### Step 1: npm dependencies

Check that `web/node_modules/.bin/cypress` exists.

If missing:
```bash
cd web && npm install
```

If `npm install` fails: emit `ENV_READY: no — npm install failed` and stop.

### Step 2: Locate export-env.sh

Check that `web/cypress/export-env.sh` exists.

If missing: emit `ENV_READY: no — export-env.sh not found. Run /cypress:setup to create it with cluster credentials.` and stop.

### Step 3: Resolve setup profile

A **setup profile** answers "what am I trying to verify today?" Every profile ultimately maps to a combination of `CYPRESS_*` install vars, but the profile is chosen by developer intent — not by knowing which flags do what.

---

#### Profile: `preinstalled`
**"The cluster is already configured. Skip all installs and just run the tests."**

Use this when you've already set the cluster up in a previous session, or when something else (a CI job, a colleague, a manual install) has already provisioned the operators. No cluster state will be modified. Fastest option — zero install time.

Vars written:
```bash
export CYPRESS_SKIP_ALL_INSTALL='true'
export CYPRESS_SESSION='true'
```

---

#### Profile: `catalog`
**"Install the operators from the RedHat catalog — the same way end users get them after release."**

This is the standard profile that matches what the CI presubmit job (`e2e-incidents`) does. COO is installed via OperatorHub from the `redhat-operators` catalog source. KBV is skipped. Choose this when you want a clean, reproducible environment that mirrors CI and real-world deployments.

Vars written:
```bash
export CYPRESS_SKIP_ALL_INSTALL='false'
export CYPRESS_SKIP_COO_INSTALL='false'
export CYPRESS_COO_UI_INSTALL='true'
export CYPRESS_SKIP_KBV_INSTALL='true'
export CYPRESS_KBV_UI_INSTALL='false'
export CYPRESS_MOCK_NEW_METRICS='false'
export CYPRESS_SESSION='true'
```

---

#### Profile: `full-stack`
**"Install both COO and KBV from the RedHat catalog."**

Use this when you need the full product suite — both the Cluster Observability Operator and the Kubernetes Virtual Machines (KBV) operator installed side-by-side. Longer setup time (~20 min). Appropriate for integration tests that span both operators.

Vars written:
```bash
export CYPRESS_SKIP_ALL_INSTALL='false'
export CYPRESS_SKIP_COO_INSTALL='false'
export CYPRESS_COO_UI_INSTALL='true'
export CYPRESS_SKIP_KBV_INSTALL='false'
export CYPRESS_KBV_UI_INSTALL='true'
export CYPRESS_MOCK_NEW_METRICS='false'
export CYPRESS_SESSION='true'
```

---

#### Profile: `custom-plugin`
**"I have a custom monitoring-plugin image I want to validate against the catalog operator."**

Use this when you're working on a plugin PR and need to test your build against a real operator from the catalog. Installs COO from the RedHat catalog (same as `catalog`), then patches the monitoring-plugin image in the CMO CSV to point to your build.

Requires one image URL:
- `MP_IMAGE` — your custom monitoring-plugin image (e.g. `quay.io/yourorg/monitoring-plugin:pr-123`)

If `CYPRESS_MP_IMAGE` is already in `export-env.sh`: read and confirm it.
If not set: prompt for the image URL and write it.

Vars written:
```bash
export CYPRESS_SKIP_ALL_INSTALL='false'
export CYPRESS_SKIP_COO_INSTALL='false'
export CYPRESS_COO_UI_INSTALL='true'
export CYPRESS_SKIP_KBV_INSTALL='true'
export CYPRESS_KBV_UI_INSTALL='false'
export CYPRESS_MOCK_NEW_METRICS='false'
export CYPRESS_SESSION='true'
export CYPRESS_MP_IMAGE='<image-url>'        # prompted if not already set
```

---

#### Profile: `custom-coo`
**"I have a custom COO build I want to validate — a Konflux bundle, a locally built bundle, or an FBC stage image."**

Use this when you're working on a COO operator PR and need to install from your specific build rather than from the catalog. The catalog install is skipped; instead, one of three image sources is used (in priority order):

| Source | Var | When to use |
|--------|-----|-------------|
| Konflux CI bundle | `KONFLUX_COO_BUNDLE_IMAGE` | Testing a Konflux pipeline build (PR or nightly) |
| Custom bundle | `CUSTOM_COO_BUNDLE_IMAGE` | Testing a locally built or manually produced bundle |
| FBC stage image | `FBC_STAGE_COO_IMAGE` | Testing against the stage File-Based Catalog |

Prompt for which source and then for the image URL if not already in `export-env.sh`. Write only the relevant var — do not write the others (the install command checks them in priority order).

Optionally, also patch the monitoring-console-plugin image inside COO:
- `MCP_CONSOLE_IMAGE` — custom monitoring-console-plugin image (prompt only if the user mentions it)
- `CHA_IMAGE` — custom cluster-health-analyzer image (prompt only if the user mentions it)

Base vars written:
```bash
export CYPRESS_SKIP_ALL_INSTALL='false'
export CYPRESS_SKIP_COO_INSTALL='false'
export CYPRESS_COO_UI_INSTALL='false'       # not from catalog
export CYPRESS_SKIP_KBV_INSTALL='true'
export CYPRESS_KBV_UI_INSTALL='false'
export CYPRESS_MOCK_NEW_METRICS='false'
export CYPRESS_SESSION='true'
# plus one of:
export CYPRESS_KONFLUX_COO_BUNDLE_IMAGE='<image-url>'
# or
export CYPRESS_CUSTOM_COO_BUNDLE_IMAGE='<image-url>'
# or
export CYPRESS_FBC_STAGE_COO_IMAGE='<image-url>'
```

---

### Profile selection logic

1. If `setup-profile` param is provided: use it directly.
2. Else, read `export-env.sh` and infer the active profile from the vars already written:
   - `SKIP_ALL_INSTALL=true` → `preinstalled`
   - `COO_UI_INSTALL=true` + `SKIP_KBV_INSTALL=true` + no image vars → `catalog`
   - `COO_UI_INSTALL=true` + `KBV_UI_INSTALL=true` → `full-stack`
   - `COO_UI_INSTALL=true` + `MP_IMAGE` set → `custom-plugin`
   - `COO_UI_INSTALL=false` + any of `KONFLUX_COO_BUNDLE_IMAGE` / `CUSTOM_COO_BUNDLE_IMAGE` / `FBC_STAGE_COO_IMAGE` set → `custom-coo`
   - Unrecognized combination → treat as unconfigured
3. If a profile is inferred: display it and ask the caller to confirm or choose a different one.
4. If unconfigured (freshly created `export-env.sh` or unrecognized state): present the five profiles with their one-line intent descriptions and ask the caller to select.

### Step 4: Write profile vars into export-env.sh

If the resolved profile matches what is already in `export-env.sh` (all vars match): **skip this step** — no rewrite needed.

Otherwise, edit the relevant `CYPRESS_*` lines in-place using the var sets defined above. When switching away from a profile that set image vars (e.g. leaving `custom-coo`), clear those image vars or comment them out to avoid stale values.

### Step 5: Check kubeconfig writability

Source `web/cypress/export-env.sh` and check `CYPRESS_KUBECONFIG_PATH`:

```bash
source web/cypress/export-env.sh && ls -la "$CYPRESS_KUBECONFIG_PATH"
```

If the kubeconfig path is read-only (e.g., the sandbox mounts `/tmp/kubeconfig` as read-only and `oc project` writes context back to it):
1. Copy to a writable location: `cp /tmp/kubeconfig /tmp/kubeconfig-rw && chmod 600 /tmp/kubeconfig-rw`
2. Rewrite the `CYPRESS_KUBECONFIG_PATH` line in `export-env.sh` to point to `/tmp/kubeconfig-rw`

If the path does not exist at all: emit `ENV_READY: no — kubeconfig not found at {path}` and stop.

### Step 6: Verify required connection vars

Source `web/cypress/export-env.sh` and check that these are set and non-empty:
- `CYPRESS_BASE_URL`
- `CYPRESS_LOGIN_USERS`
- `CYPRESS_KUBECONFIG_PATH`

If any are missing: emit `ENV_READY: no — missing required vars: {list}` and stop.

### Step 7: Emit result

```
ENV_READY: yes
Profile: {profile-name} — {one-line intent}
npm: ready (node_modules present)
kubeconfig: {path} (writable)
BASE_URL: {url}
LOGIN_USERS: {redacted — user:***}
Warnings: {any non-fatal issues, or "none"}
```

If anything failed in Steps 1–6: emit `ENV_READY: no — {reason}` instead and stop without proceeding to run any tests.
