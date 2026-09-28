---
name: cypress-setup
description: Prepare this repository's Cypress environment and configure its local variables. Use when the user asks to install or configure Cypress testing.
---

# Set up Cypress

1. Work from the repository root and require Node.js 22 or newer, as declared by `web/package.json`.
2. Install the frontend dependencies from `web/` using the repository's package manager and lockfile. Do not look for a package under `web/cypress/`.
3. Check for the ignored `web/cypress/export-env.sh` without printing its contents or credential values.
4. If it exists, ask whether to reuse it. If it does not exist or the user requests reconfiguration, run `web/cypress/configure-env.sh` interactively from `web/cypress/`.
5. Direct terminal use is the default. Explain that environment variables affect only the shell in which the export file is sourced.

For an optional desktop terminal, use the operating-system helper under `../cypress-run/scripts/` relative to this skill:

```bash
# Linux
.agents/skills/cypress-run/scripts/open-cypress-terminal-linux.sh [--configure]

# macOS
.agents/skills/cypress-run/scripts/open-cypress-terminal-macos.sh [--configure]
```

Do not open a GUI terminal unless the user requests it or interactive configuration cannot run in the current terminal.
