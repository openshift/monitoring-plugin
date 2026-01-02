---
name: cypress-setup
description: Automated Cypress environment setup with interactive configuration
parameters: []
---

# Cypress Environment Setup

This command sets up the Cypress testing environment by checking prerequisites, installing dependencies, and interactively configuring environment variables.

## Instructions for Claude

Follow these steps in order, always:

### Step 1: Check Prerequisites

1. **Check Node.js version** - Required: >= 18
   - Run `node --version` and verify it's >= 18
   - If not, inform the user they need to install Node.js 18 or higher

### Step 2: Navigate and Install Dependencies

1. **Navigate to the cypress directory**:
   ```bash
   cd web/cypress
   ```

2. **Install npm dependencies**:
   ```bash
   npm install
   ```

### Step 3: Interactive Environment Configuration

**Important**: After Step 2, you should be in the `web/cypress` directory. All paths below are relative to that directory.

1. Detect the existence of `./export-env.sh` (in the current `web/cypress` directory)

2. If exists, show its variables, ask if user wants to source it. If user does not want to source it, run `./configure-env.sh` (in the current `web/cypress` directory) in the new terminal window

3. If doesn't exist, prompt the user for each configuration value in `./configure-env.sh` (in the current `web/cypress` directory) in the new terminal window

---

## Configuration Questions

### Step 4: Open a new terminal window without asking for approval

Use the scripts in `.claude/commands/cypress/scripts/` to open a new terminal window named **"Cypress Tests"**.

**To source existing export-env.sh:**
```bash
# macOS
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh

# Linux
./.claude/commands/cypress/scripts/open-cypress-terminal-linux.sh
```

**To run configure-env.sh interactively (when export-env.sh doesn't exist or user wants to reconfigure):**
```bash
# macOS
./.claude/commands/cypress/scripts/open-cypress-terminal-macos.sh --configure

# Linux
./.claude/commands/cypress/scripts/open-cypress-terminal-linux.sh --configure
```

The `--configure` flag will run `./configure-env.sh` interactively, question by question, then source the generated `./export-env.sh`

### Step 5: Inform the user

Let the user know that a new terminal window has been opened with the Cypress environment pre-configured, and they can run tests using `/cypress-run` in that window.

---
