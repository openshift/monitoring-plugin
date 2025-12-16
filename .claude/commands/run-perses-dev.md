---
name: run-perses-dev
description: Setup a development environment for monitoring-console-plugin + perses
parameters:
  - name: perses_path
  - description: The path on the local machine that points to a clone of https://github.com/perses/perses (e.g. /Users/bob/git_repos/perses)
  - required: true
allowed-tools: Read, Grep, tmux, which, ls, lsof, oc 
---

0. perses_path 
- Go to the root and cd .claude/commands/configs/run-perses-dev-config.yaml
- If not defined, create the file and fill out the perses path 

1. Create a tmux session called 'monitoring-perses-dev' with 8 panes =  4 columns x 2 rows 
Split horitzontally, then split verically.
Then go clockwise and split horitzontally. 
- Pane 0
    - Path: monitoring-plugin (root of this repo)
    - Label: monitoring-console-plugin-frontend 
    - Run:  make start-frontend
- Pane 2
    - Path: monitoring-plugin (root of this repo)
    - Label: monitoring-console-plugin-console  
    - Run: make start-feature-console
- Pane 4
    - Path: monitoring-plugin (root of this repo)
    - Label: monitoring-console-plugin-backend 
    - Run: make start-feature-backend
- Pane 6
    - Path: monitoring-plugin (root of this repo)
    - Label: port-forward-promtheus-operator
    - Run: oc port-forward -n openshift-monitoring service/prometheus-operated 9090:9090
- Pane 1
    - Path: `{perses_path}`
    - Label: perses-backend
    - Run: ./scripts/api_backend_dev.sh
- Pane 3
    - Path: `{perses_path}/ui`
    - Label: perses-ui
    - Run: npm run start

2. Final checks 
- Check if all the processes in each pane is running without error. If there is a error diagnose and fix it. 
- In bold output, tell the user the name of the session and tmux session tips like how to attach to sessions, how to move around the panels using prefix + arrows, how to delete a session, how to list session
- Navigate to `{perses_path}/dev/config.yaml`. The spec `security.enable_auth` should be `false`. 
- Tell user that openshift console platform is located at  http://localhost:9000
- Tell user that perses is located at http://localhost:3000 
 

