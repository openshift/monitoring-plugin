---
name: cypress-run 
description: Display Cypress test commands - choose execution mode (headless recommended)
parameters:
  - name: execution-mode
    description: Choose execution mode - headless (recommended), headed, or interactive
    required: true
    type: string
---

# Cypress Test Commands

**Prerequisites**: 
1. Run `/cypress-setup` first to configure your environment.
2. Ensure the "Cypress Tests" terminal window is open (created by `/cypress-setup`)

**Note**: All commands are executed in the "Cypress Tests" terminal window using the helper scripts.

---

## Execution Modes

1. **Headless** (Recommended) - Fast, automated testing without visible browser
2. **Headed** - Watch tests execute in visible browser for debugging
3. **Interactive** - Visual UI to pick and run tests manually

---

## How to Run Commands in Cypress Tests Terminal

All npm commands should be executed in the "Cypress Tests" terminal using the helper scripts:

**macOS:**
```bash
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "npm run <command>"
```

**Linux:**
```bash
./.claude/commands/cypress/scripts/open-cypress-terminal-linux.sh --run "npm run <command>"
```

**Instructions**: Based on the `execution-mode` parameter provided by the user:
- If `execution-mode` is "interactive": Display ONLY the "Interactive Mode" section below
- If `execution-mode` is "headless": display ONLY the "Headless Mode" section with interactive options to be chosen
- If `execution-mode` is "headed": display ONLY the "Headed Mode" section with interactive options to be chosen

**IMPORTANT**: Always execute the selected command using the appropriate script:
- macOS: `./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "<command>"`
- Linux: `./.claude/commands/cypress/scripts/open-cypress-terminal-linux.sh --run "<command>"`


---

# Interactive Mode

**Cypress Interactive Test Runner** - Pick and run tests visually with Cypress UI.

## What is Interactive Mode?

Interactive mode opens the Cypress Test Runner UI where you can:
- Browse and select tests visually
- Watch tests run in real-time with time-travel debugging
- Inspect DOM snapshots at each step
- See detailed command logs
- Rerun tests with a single click
- Perfect for test development and debugging

## Command

**Open Cypress Interactive UI (run in Cypress Tests terminal):**

macOS:
```bash
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "npm run cypress:open"
```

Linux:
```bash
./.claude/commands/cypress/scripts/open-cypress-terminal-linux.sh --run "npm run cypress:open"
```

This opens a visual interface where you can:
1. Choose a browser (Chrome, Firefox, Edge, Electron)
2. Browse your test files
3. Click any test to run it
4. Watch it execute step-by-step
5. Debug failures interactively

## Benefits

- **Visual Testing**: See exactly what's happening
- **Fast Iteration**: Make changes and rerun instantly
- **Easy Debugging**: Inspect any step of your test
- **Browser DevTools**: Full access to browser debugging tools
- **Selector Playground**: Helps you write better selectors

## When to Use

- Developing new tests
- Debugging test failures
- Learning how tests work
- Demonstrating tests to others

---

# Headless Mode Commands

All commands below run tests in headless mode (no visible browser).

## Dynamic Command Discovery

**IMPORTANT**: Before showing test commands, you MUST dynamically read:

### 1. Available NPM Scripts
Read `web/package.json` and extract all scripts matching `test-cypress-*` and `cypress:*` patterns.
Present them as available test suite commands.

### 2. Available Test Spec Files  
Scan `web/cypress/e2e/` directory recursively and list all `.cy.ts` files.
Present them as available spec file targets for `--spec` option.

---

## Quick Reference - Base Commands

**Run with npm script (if defined in package.json):**
```bash
npm run <script-name>
```

**Run all tests headless:**
```bash
npm run cypress:run
```

**Run specific spec file:**
```bash
npm run cypress:run -- --spec "cypress/e2e/<path-to-file>.cy.ts"
```

**Run with custom tags:**
```bash
npm run cypress:run -- --env grepTags="<YOUR_TAGS_HERE>"
```

---

## NPM Scripts from package.json

**Instructions**: Read `web/package.json` and list ALL scripts that start with:
- `test-cypress-*` (predefined test suites)
- `cypress:*` (base cypress commands)

For each script found, display:
```bash
npm run <script-name>
```

Add a brief description based on the grepTags or other flags in the script definition.

---

## Spec Files from cypress/e2e

**Instructions**: Scan `web/cypress/e2e/` recursively and organize by folder:

For each `.cy.ts` file found, show the command:
```bash
npm run cypress:run -- --spec "cypress/e2e/<relative-path>"
```

Group files by their parent folder (monitoring, coo, perses, virtualization, incidents, etc.)

---

## Custom Tag Combinations - Headless

**Base command for custom tags:**
```bash
npm run cypress:run -- --env grepTags="YOUR_TAGS_HERE"
```

**Tag Operators:**
- `+` = AND (e.g., `@alerts+@smoke` = alerts AND smoke)
- `--` = NOT (e.g., `@monitoring --@flaky` = monitoring but NOT flaky)
- `,` = OR (e.g., `@alerts,@metrics` = alerts OR metrics)

**Common tag patterns:**

| Goal | Command |
|------|---------|
| Smoke tests only | `npm run cypress:run -- --env grepTags="@smoke"` |
| Exclude flaky | `npm run cypress:run -- --env grepTags="<tag> --@flaky"` |
| Exclude demo | `npm run cypress:run -- --env grepTags="<tag> --@demo"` |
| Fast smoke | `npm run cypress:run -- --env grepTags="@smoke --@slow --@flaky"` |

---

## Running Multiple Spec Files

**Comma-separate spec paths:**
```bash
npm run cypress:run -- --spec "cypress/e2e/<file1>.cy.ts,cypress/e2e/<file2>.cy.ts"
```

---

## Advanced Headless Options

**Run with specific browser:**
```bash
npm run cypress:run -- --browser firefox
npm run cypress:run -- --browser edge
npm run cypress:run -- --browser chrome
```

**Disable video recording:**
```bash
npm run cypress:run -- --config video=false
```

**Disable screenshots:**
```bash
npm run cypress:run -- --config screenshotOnRunFailure=false
```

---

# Headed Mode Commands

All commands below open a visible browser window.

## Quick Start - Headed

**Interactive Mode (Cypress UI, pick tests manually):**
```bash
npm run cypress:open
```

**Base headed mode command:**
```bash
npm run cypress:run -- --headed
```

---

## Dynamic Command Discovery

**IMPORTANT**: Before showing test commands, you MUST dynamically read:

### 1. Available Test Spec Files  
Scan `web/cypress/e2e/` directory recursively and list all `.cy.ts` files.
Present them as available spec file targets with `--headed` flag.

### 2. Available Tags
Extract grepTags patterns from `web/package.json` scripts to show common tag combinations.

---

## Running Test Suites - Headed

To run any tag-based suite in headed mode, add `--headed` flag:
```bash
npm run cypress:run -- --headed --env grepTags="<TAG_COMBINATION>"
```

**Examples based on common tags:**
```bash
# Monitoring tests (headed)
npm run cypress:run -- --headed --env grepTags="@monitoring --@flaky"

# Smoke tests (headed)
npm run cypress:run -- --headed --env grepTags="@smoke --@flaky"

# COO tests (headed)
npm run cypress:run -- --headed --env grepTags="@coo --@flaky"
```

---

## Running Specific Files - Headed

**Template:**
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/<path-to-file>.cy.ts"
```

**Instructions**: Scan `web/cypress/e2e/` and for each `.cy.ts` file, the headed command is:
```bash
npm run cypress:run -- --headed --spec "cypress/e2e/<relative-path>"
```

---

## Advanced Headed Options

**Headed with specific browser:**
```bash
npm run cypress:run -- --headed --browser chrome
npm run cypress:run -- --headed --browser firefox
npm run cypress:run -- --headed --browser edge
```

**Headed without video:**
```bash
npm run cypress:run -- --headed --config video=false
```

---

## Available Tags Reference

Use these tags with `--env grepTags`:

**Feature Tags:**
- `@monitoring` - Core monitoring plugin tests
- `@monitoring-dev` - Developer user tests
- `@alerts` - Alert-related tests
- `@metrics` - Metrics explorer tests
- `@dashboards` - Legacy dashboard tests
- `@perses` - Perses dashboard tests
- `@coo` - Observability Operator tests
- `@acm` - Advanced Cluster Management tests
- `@virtualization` - OpenShift Virtualization tests
- `@incidents` - Incidents feature tests

**Modifier Tags:**
- `@smoke` - Quick smoke tests
- `@slow` - Longer running tests
- `@flaky` - Known flaky tests
- `@demo` - Demo/showcase tests

**Tag Operators:**
- `+` = AND (e.g., `@alerts+@smoke` = alerts AND smoke)
- `--` = NOT (e.g., `@monitoring --@flaky` = monitoring but NOT flaky)
- `,` = OR (e.g., `@alerts,@metrics` = alerts OR metrics)

---

## Related Commands

- **`/cypress-setup`** - Configure testing environment and open Cypress Tests terminal

---

## Running Commands via Scripts

All cypress commands should be executed in the "Cypress Tests" terminal using:

**macOS:**
```bash
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "<your-command>"
```

**Linux:**
```bash
./.claude/commands/cypress/scripts/open-cypress-terminal-linux.sh --run "<your-command>"
```

**Examples:**
```bash
# Run smoke tests (macOS)
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "npm run test-cypress-smoke"

# Run specific spec file (macOS)
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "npm run cypress:run -- --spec 'cypress/e2e/monitoring/00.bvt_admin.cy.ts'"

# Run with custom tags (macOS)
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "npm run cypress:run -- --env grepTags='@monitoring --@flaky'"

# Open interactive mode (macOS)
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --run "npm run cypress:open"
```

---

## Documentation

- `web/cypress/README.md` - Setup and execution guide
- `web/cypress/E2E_TEST_SCENARIOS.md` - Complete test catalog
- `web/cypress/CYPRESS_TESTING_GUIDE.md` - Testing best practices
