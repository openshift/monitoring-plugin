---
name: run-perses-dev
description: Start the monitoring-console-plugin and a local Perses checkout together in a tmux development session. Use when the user asks to run the integrated Perses development environment.
---

# Run the Perses development environment

Run this workflow only on an explicit request. It starts local processes and an OpenShift port-forward but does not install or modify cluster resources.

## Inputs and configuration

Obtain the absolute Perses checkout path from the request or `.agents/local/run-perses-dev-config.yaml`:

```yaml
perses_path: /absolute/path/to/perses
```

If neither supplies it, ask for the path. Save a user-supplied path there for reuse; `.agents/local/` is ignored. Do not display credential values from any local configuration.

## Checks

1. Locate the repository root independently of the current directory.
2. Verify `tmux`, `oc`, Node/npm, the Perses checkout, and all commands below exist.
3. Inspect `{perses_path}/dev/config.yaml`. `security.enable_auth` must be `false`; ask before editing the external checkout if it is not.
4. If a `monitoring-perses-dev` session already exists, report it and ask before replacing it.

## Session

Create `monitoring-perses-dev` with eight panes arranged as four columns by two rows. Set descriptive pane titles and start:

| Pane | Directory | Command |
| --- | --- | --- |
| 0 | repository root | `make start-frontend` |
| 1 | Perses checkout | `./scripts/api_backend_dev.sh` |
| 2 | repository root | `make start-console` |
| 3 | `{perses_path}/ui` | `npm run start` |
| 4 | repository root | `make start-coo-backend` |
| 6 | repository root | `oc port-forward -n openshift-monitoring service/prometheus-operated 9090:9090` |

Leave panes 5 and 7 available for diagnostics. After startup, capture recent output from each active pane and report errors instead of silently retrying or changing configuration.

Finish by reporting the session name, `tmux attach -t monitoring-perses-dev`, pane navigation, session listing/termination commands, the console URL `http://localhost:9000`, and the Perses URL `http://localhost:3000`.
