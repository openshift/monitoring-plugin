---
name: cypress-setup
description: Automated Cypress environment setup with minimal approvals
parameters: []
---

# Cypress Setup (Automated)

This command validates prerequisites, detects workspace, creates setup script, and opens terminal automatically - all with minimal approvals.

---

## Execution Flow

```bash
#!/bin/bash
set -euo pipefail

echo "🔧 Cypress Setup"
echo ""

# [1/4] Validate prerequisites
echo "[1/4] Validating prerequisites..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version 2>/dev/null)
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    echo "      ✓ Node.js: $NODE_VERSION"
  else
    echo "      ❌ Node.js too old (required: >= v18.0.0)"
    echo ""
    echo "Upgrade instructions:"
    echo "  macOS: brew install node@18"
    echo "  Linux: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
  fi
else
  echo "      ❌ Node.js not found"
  echo ""
  echo "Installation instructions:"
  echo "  macOS: brew install node@18"
  echo "  Linux: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

if command -v npm &> /dev/null; then
  echo "      ✓ npm: $(npm --version)"
else
  echo "      ❌ npm not found"
  exit 1
fi

# [2/4] Detect workspace
echo "[2/4] Detecting workspace..."
WORKSPACE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$WORKSPACE_ROOT" ]; then
  CURRENT_DIR=$(pwd)
  if [ -d "$CURRENT_DIR/web/cypress" ]; then
    WORKSPACE_ROOT="$CURRENT_DIR"
  elif [ -d "$CURRENT_DIR/cypress" ] && [ -f "$CURRENT_DIR/package.json" ]; then
    WORKSPACE_ROOT=$(dirname "$CURRENT_DIR")
  elif [ -f "$CURRENT_DIR/configure-env.sh" ]; then
    WORKSPACE_ROOT=$(dirname $(dirname "$CURRENT_DIR"))
  else
    echo "      ❌ Could not detect workspace"
    exit 1
  fi
fi

WEB_DIR="$WORKSPACE_ROOT/web"
CYPRESS_DIR="$WEB_DIR/cypress"

if [ ! -d "$CYPRESS_DIR" ]; then
  echo "      ❌ Invalid repository structure"
  exit 1
fi
echo "      ✓ Workspace detected"

# [3/4] Create setup script
echo "[3/4] Creating setup script..."
TEMP_SCRIPT="/tmp/cypress-setup-$$.sh"

cat > "$TEMP_SCRIPT" 2>/dev/null << 'SCRIPT_END'
#!/bin/bash
set -euo pipefail

SCRIPT_PATH="$0"
cleanup() { rm -f "$SCRIPT_PATH"; }
trap cleanup EXIT

echo "🔧 Cypress Setup"
echo ""

cd "WEB_DIR_PLACEHOLDER"

echo "[1/6] Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "      ✓ Dependencies installed"
else
  npm install > /dev/null 2>&1
  echo "      ✓ Dependencies installed"
fi

cd cypress

NEED_RECONFIGURE=0

if [ -f "./export-env.sh" ]; then
  echo "[2/6] Validating existing configuration..."
  
  CYPRESS_BASE_URL=$(grep "^export CYPRESS_BASE_URL=" ./export-env.sh | cut -d"'" -f2)
  CYPRESS_KUBECONFIG_PATH=$(grep "^export CYPRESS_KUBECONFIG_PATH=" ./export-env.sh | cut -d"'" -f2)
  
  if [[ -n "$CYPRESS_BASE_URL" && -n "$CYPRESS_KUBECONFIG_PATH" ]]; then
    CLUSTER_VALID=1
    
    if [[ ! -f "$CYPRESS_KUBECONFIG_PATH" ]]; then
      CLUSTER_VALID=0
    elif command -v oc &> /dev/null; then
      if ! oc --kubeconfig="$CYPRESS_KUBECONFIG_PATH" whoami --request-timeout=10s &> /dev/null 2>&1; then
        CLUSTER_VALID=0
      fi
    fi
    
    if command -v curl &> /dev/null; then
      HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 10 "$CYPRESS_BASE_URL" 2>/dev/null || echo "000")
      if ! echo "$HTTP_CODE" | grep -qE "200|301|302|403|401"; then
        CLUSTER_VALID=0
      fi
    fi
    
    if [ $CLUSTER_VALID -eq 1 ]; then
      echo "      ✓ Cluster still accessible"
      source ./export-env.sh
      NEED_RECONFIGURE=0
    else
      echo "      ⚠️  Cluster expired, reconfiguring..."
      NEED_RECONFIGURE=1
    fi
  else
    NEED_RECONFIGURE=1
  fi
else
  echo "[2/6] No configuration found"
  NEED_RECONFIGURE=1
fi

if [ $NEED_RECONFIGURE -eq 1 ]; then
  echo "[3/6] Running configuration..."
  [ ! -x "./configure-env.sh" ] && chmod +x ./configure-env.sh
  echo ""
  ./configure-env.sh
  [ $? -ne 0 ] && echo "❌ Configuration cancelled" && read -n 1 && exit 1
  [ ! -f "./export-env.sh" ] && echo "❌ No export-env.sh created" && read -n 1 && exit 1
  echo "[4/6] Loading environment..."
  source ./export-env.sh
else
  echo "[3/6] ✓ Using existing configuration"
  echo "[4/6] ✓ Environment loaded"
fi

echo "[5/6] Validating..."
VALIDATION_FAILED=0
[[ -z "$CYPRESS_BASE_URL" ]] && echo "      ✗ CYPRESS_BASE_URL missing" && VALIDATION_FAILED=1
[[ -z "$CYPRESS_LOGIN_IDP" ]] && echo "      ✗ CYPRESS_LOGIN_IDP missing" && VALIDATION_FAILED=1
[[ -z "$CYPRESS_LOGIN_USERS" ]] && echo "      ✗ CYPRESS_LOGIN_USERS missing" && VALIDATION_FAILED=1
[[ -z "$CYPRESS_KUBECONFIG_PATH" ]] && echo "      ✗ CYPRESS_KUBECONFIG_PATH missing" && VALIDATION_FAILED=1

if [ $VALIDATION_FAILED -eq 1 ]; then
  echo "❌ Validation failed" && read -n 1 && exit 1
fi

echo "[6/6] Final cluster check..."
if [[ -f "$CYPRESS_KUBECONFIG_PATH" ]] && command -v oc &> /dev/null; then
  if oc --kubeconfig="$CYPRESS_KUBECONFIG_PATH" whoami --request-timeout=10s &> /dev/null 2>&1; then
    echo "      ✓ Cluster accessible"
  else
    echo "      ✗ Cluster authentication failed" && read -n 1 && exit 1
  fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next: /cypress-run to see test commands"
echo ""
echo "Sourcing environment variables for this terminal session..."
SCRIPT_END

sed -i.bak "s|WEB_DIR_PLACEHOLDER|$WEB_DIR|g" "$TEMP_SCRIPT" 2>/dev/null && rm -f "$TEMP_SCRIPT.bak"
chmod +x "$TEMP_SCRIPT" 2>/dev/null

echo "      ✓ Setup script created"

# [4/4] Open terminal
echo "[4/4] Opening terminal..."

TERMINAL_NAME="cypress-monitoring"
OS_TYPE=$(uname -s)

# Create a wrapper script that sources export-env.sh after setup
WRAPPER_SCRIPT="/tmp/cypress-wrapper-$$.sh"
cat > "$WRAPPER_SCRIPT" 2>/dev/null << WRAPPER_END
#!/bin/bash
$TEMP_SCRIPT
cd "$CYPRESS_DIR"
if [ -f "./export-env.sh" ]; then
  source ./export-env.sh
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Environment variables loaded:"
  echo "   • CYPRESS_BASE_URL=\$CYPRESS_BASE_URL"
  echo "   • CYPRESS_LOGIN_IDP=\$CYPRESS_LOGIN_IDP"
  echo "   • CYPRESS_KUBECONFIG_PATH=\$CYPRESS_KUBECONFIG_PATH"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi
# Use user's default shell (typically zsh on macOS)
exec \$SHELL
WRAPPER_END
chmod +x "$WRAPPER_SCRIPT" 2>/dev/null

if [[ "$OS_TYPE" == "Darwin" ]]; then
  osascript <<APPLESCRIPT 2>/dev/null
tell application "Terminal"
    set newTab to do script "$WRAPPER_SCRIPT"
    set custom title of newTab to "$TERMINAL_NAME"
    activate
end tell
APPLESCRIPT
  echo "      ✓ Terminal opened: 'cypress-monitoring'"
elif [[ "$OS_TYPE" == "Linux" ]]; then
  if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="$TERMINAL_NAME" -- bash -c "$WRAPPER_SCRIPT" 2>/dev/null &
  elif command -v konsole &> /dev/null; then
    konsole --new-tab -p tabtitle="$TERMINAL_NAME" -e bash -c "$WRAPPER_SCRIPT" 2>/dev/null &
  elif command -v xterm &> /dev/null; then
    xterm -T "$TERMINAL_NAME" -e bash -c "$WRAPPER_SCRIPT" 2>/dev/null &
  elif command -v xfce4-terminal &> /dev/null; then
    xfce4-terminal --title="$TERMINAL_NAME" -e "bash -c '$WRAPPER_SCRIPT'" 2>/dev/null &
  else
    echo "      ❌ No terminal found"
    exit 1
  fi
  echo "      ✓ Terminal opened: 'cypress-monitoring'"
else
  echo "      ❌ Unsupported OS: $OS_TYPE"
  exit 1
fi

echo ""
```

---

## What This Command Does

1. **Validates Prerequisites** ✅
   - Checks Node.js >= v18
   - Checks npm installation
   - **Auto-passes** if requirements met
   - **Only stops** if prerequisites fail (shows install instructions)

2. **Detects Workspace** ✅
   - Auto-detects from where you run the command
   - Uses git or directory structure
   - Validates cypress directory exists
   - **No manual input needed**

3. **Creates Setup Script** ✅
   - Generates temporary setup script
   - Configures for detected workspace
   - Sets up auto-cleanup
   - **No approval needed**

4. **Opens Terminal & Runs** ✅
   - Opens "cypress-monitoring" terminal
   - Runs setup script automatically
   - Validates existing config or runs configure-env.sh
   - **Everything happens automatically**

---

## Setup Script Flow (in New Terminal)

The opened terminal runs these steps automatically:

```
[1/6] Checking dependencies...
      ✓ Dependencies installed

[2/6] Validating existing configuration...
      ✓ Cluster still accessible
      
[3/6] ✓ Using existing configuration
[4/6] ✓ Environment loaded
[5/6] Validating...
[6/6] Final cluster check...
      ✓ Cluster accessible

✅ Setup complete!

Next: /cypress-run to see test commands
```

Or if reconfiguration is needed, it runs `configure-env.sh` interactively.

---

## Differences from `/cypress-setup`

| Feature | `/cypress-setup` | `/cypress-setup1` |
|---------|-----------------|-------------------|
| **Prerequisite Check** | Manual approval | Auto-pass/fail only |
| **Workspace Detection** | Manual approval | Automatic |
| **Script Creation** | Manual approval | Automatic |
| **Terminal Opening** | Manual approval | Automatic |
| **Total Approvals** | 1 combined | 1 combined |
| **User Experience** | More explicit steps | Fully automated |

Both have **one approval**, but `/cypress-setup1` does everything automatically without showing intermediate steps.

---

## Usage

Simply run from anywhere in the monitoring-plugin repository:

```
/cypress-setup1
```

**What you'll see:**
```
🔧 Cypress Setup

[1/4] Validating prerequisites...
      ✓ Node.js: v18.x.x
      ✓ npm: 9.x.x
[2/4] Detecting workspace...
      ✓ Workspace detected
[3/4] Creating setup script...
      ✓ Setup script created
[4/4] Opening terminal...
      ✓ Terminal opened: 'cypress-monitoring'
```

Then the "cypress-monitoring" terminal opens and completes setup automatically!

---

## Prerequisites

- Node.js >= v18.0.0
- npm
- OpenShift cluster access
- `oc` CLI (optional but recommended)

---

## Platform Support

- **macOS**: Uses `Terminal.app` with AppleScript
- **Linux**: Supports `gnome-terminal`, `konsole`, `xterm`, `xfce4-terminal`

---

## Benefits

✅ **Minimal Approvals** - One approval for everything
✅ **Auto-Detection** - Finds workspace automatically  
✅ **Auto-Validation** - Only stops if prerequisites fail
✅ **Clean Output** - Progress indicators only
✅ **Self-Cleaning** - Temp script auto-deletes
✅ **Smart Reuse** - Validates and reuses existing config when possible

---

## Related Commands

- **`/cypress-setup`** - Original setup with explicit steps
- **`/cypress-run`** - See available test commands

