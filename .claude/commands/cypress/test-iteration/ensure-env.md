# Ensure Environment

Layer 1 primitive: prepare the full test session — npm dependencies, writable kubeconfig, required connection vars, and setup profile. **Call once per session**, before the first `run-suite`. Do not call again inside iteration loops.

## Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `setup-profile` | no | `incidents` / `full-ui-install` / `skip-all-install` / `custom-images`. Prompts if absent and not already configured. |

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

A **setup profile** captures what kind of cluster session we are in and controls which `CYPRESS_*` install/behavior vars are written into `export-env.sh`.

**Profile definitions:**

| Profile | Description | Key vars written |
|---------|-------------|------------------|
| `incidents` | COO from RedHat catalog, KBV skipped, mocked metrics off, session on | `SKIP_ALL_INSTALL=false`, `SKIP_COO_INSTALL=false`, `COO_UI_INSTALL=true`, `SKIP_KBV_INSTALL=true`, `KBV_UI_INSTALL=false`, `MOCK_NEW_METRICS=false`, `SESSION=true` |
| `full-ui-install` | COO + KBV both installed from RedHat catalog | `SKIP_ALL_INSTALL=false`, `SKIP_COO_INSTALL=false`, `COO_UI_INSTALL=true`, `SKIP_KBV_INSTALL=false`, `KBV_UI_INSTALL=true`, `SESSION=true` |
| `skip-all-install` | Everything pre-provisioned; skip all operator/plugin installs | `SKIP_ALL_INSTALL=true`, `SESSION=true` |
| `custom-images` | Like `incidents` but patches in custom operator/plugin images | Same as `incidents` + `MP_IMAGE`, `MCP_CONSOLE_IMAGE`, `KONFLUX_COO_BUNDLE_IMAGE`, etc. — prompt for image URLs if not already in export-env.sh |

**Resolution logic:**

1. If `setup-profile` param is provided: use it.
2. Else, check whether profile vars are already written into `export-env.sh` by reading the file and inspecting `CYPRESS_COO_UI_INSTALL`, `CYPRESS_SKIP_ALL_INSTALL`, `CYPRESS_SKIP_KBV_INSTALL`. If recognized, infer the active profile, display it, and ask:
   ```
   Current profile appears to be: {inferred-profile}
   Confirm this profile, or choose a different one:
   1. incidents
   2. full-ui-install
   3. skip-all-install
   4. custom-images
   [Enter to confirm, or 1-4 to change]
   ```
3. If profile vars are absent (e.g. a freshly created export-env.sh), present the profile menu and ask the caller to select.

### Step 4: Write profile vars into export-env.sh

If the resolved profile matches what is already in `export-env.sh` (all vars match): **skip this step** — no rewrite needed.

Otherwise, update `export-env.sh` by editing the relevant `CYPRESS_*` lines in-place:

- For `incidents`:
  ```bash
  export CYPRESS_SKIP_ALL_INSTALL='false'
  export CYPRESS_SKIP_COO_INSTALL='false'
  export CYPRESS_COO_UI_INSTALL='true'
  export CYPRESS_SKIP_KBV_INSTALL='true'
  export CYPRESS_KBV_UI_INSTALL='false'
  export CYPRESS_MOCK_NEW_METRICS='false'
  export CYPRESS_SESSION='true'
  ```

- For `full-ui-install`:
  ```bash
  export CYPRESS_SKIP_ALL_INSTALL='false'
  export CYPRESS_SKIP_COO_INSTALL='false'
  export CYPRESS_COO_UI_INSTALL='true'
  export CYPRESS_SKIP_KBV_INSTALL='false'
  export CYPRESS_KBV_UI_INSTALL='true'
  export CYPRESS_SESSION='true'
  ```

- For `skip-all-install`:
  ```bash
  export CYPRESS_SKIP_ALL_INSTALL='true'
  export CYPRESS_SESSION='true'
  ```

- For `custom-images`: same base as `incidents`, plus any custom image vars already present (or prompt for them).

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
Profile: {profile-name}
npm: ready (node_modules present)
kubeconfig: {path} (writable)
BASE_URL: {url}
LOGIN_USERS: {redacted — user:***}
Warnings: {any non-fatal issues, or "none"}
```

If anything failed in Steps 1–6: emit `ENV_READY: no — {reason}` instead and stop without proceeding to run any tests.
