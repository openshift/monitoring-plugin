---
name: cypress-run
description: Select and run this repository's Cypress tests by mode, suite, tags, or spec. Use when the user asks to run or open Cypress tests.
---

# Run Cypress

Run Cypress only on an explicit request. Work from `web/`; Cypress has no separate package in `web/cypress/`.

## Select the command

1. Use headless mode unless the user requests headed or interactive mode.
2. Discover current scripts from `web/package.json` and specs under `web/cypress/` instead of relying on a static command list.
3. Accept a package script, suite, grep tags, one or more `--spec` paths, or additional Cypress arguments. Resolve ambiguous suite names before starting an expensive run.
4. If `web/cypress/export-env.sh` is missing, read `.agents/skills/cypress-setup/SKILL.md` and follow its setup workflow. Source the result without printing its contents.

Typical direct execution from `web/` is:

```bash
source cypress/export-env.sh
npm run cypress:run -- --spec 'cypress/e2e/path/to/spec.cy.ts'
```

Use `npm run cypress:open` for interactive mode and `npm run cypress:run -- --headed ...` for headed execution. Preserve the user's extra arguments after `--`.

## Logs and status

For long headless runs, capture combined output to a named file under `/tmp` while preserving Cypress's exit status (for example with Bash `set -o pipefail` and `PIPESTATUS`). Report the command, log path, exit status, and failing specs. Do not retry failures automatically.

## Optional desktop terminal

Direct execution is preferred. When the user asks for a separate GUI terminal, run the matching helper in `scripts/` with `--run "<command>"`. The helpers locate the repository root, source the ignored environment file, and open or reuse a terminal named `Cypress Tests`.
