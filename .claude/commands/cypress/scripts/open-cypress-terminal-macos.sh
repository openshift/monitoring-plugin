#!/usr/bin/env bash
# Open a named Terminal window for Cypress testing on macOS
# Usage:
#   ./open-cypress-terminal-macos.sh                    # Source export-env.sh
#   ./open-cypress-terminal-macos.sh --configure        # Run configure-env.sh interactively
#   ./open-cypress-terminal-macos.sh --run "command"    # Run a command in the Cypress Tests terminal

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Navigate from .claude/commands/cypress/scripts/ to web/cypress
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CYPRESS_DIR="$REPO_ROOT/web/cypress"
TERMINAL_NAME="Cypress Tests"

show_usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
    --configure         Run configure-env.sh interactively in the terminal
    --run "command"     Run a specific command in the Cypress Tests terminal
    --help              Show this help message

Examples:
    $(basename "$0")                                    # Open terminal and source export-env.sh
    $(basename "$0") --configure                        # Run configure-env.sh interactively
    $(basename "$0") --run "npm run cypress:open"       # Run a cypress command
    $(basename "$0") --run "npm run test-cypress-smoke" # Run smoke tests
EOF
}

# Check if Cypress Tests terminal already exists and get its window ID
find_cypress_terminal() {
    osascript -e '
        tell application "Terminal"
            repeat with w in windows
                if custom title of w is "'"$TERMINAL_NAME"'" then
                    return id of w
                end if
            end repeat
            return ""
        end tell
    ' 2>/dev/null || echo ""
}

# Run command in existing Cypress Tests terminal
run_in_existing_terminal() {
    local cmd="$1"
    osascript <<EOF
        tell application "Terminal"
            repeat with w in windows
                if custom title of w is "$TERMINAL_NAME" then
                    do script "$cmd" in w
                    activate
                    return
                end if
            end repeat
        end tell
EOF
}

# Open new terminal with source export-env.sh
open_with_source() {
    osascript <<EOF
        tell application "Terminal"
            do script "cd '$CYPRESS_DIR' && source ./export-env.sh && echo '✅ Environment loaded from export-env.sh' && echo 'You can now run Cypress tests.' && echo ''"
            delay 0.5
            set custom title of front window to "$TERMINAL_NAME"
            activate
        end tell
EOF
}

# Open new terminal and run configure-env.sh
open_with_configure() {
    osascript <<EOF
        tell application "Terminal"
            do script "cd '$CYPRESS_DIR' && ./configure-env.sh && source ./export-env.sh && echo '' && echo '✅ Environment configured and loaded.' && echo 'You can now run Cypress tests.' && echo ''"
            delay 0.5
            set custom title of front window to "$TERMINAL_NAME"
            activate
        end tell
EOF
}

# Main
main() {
    local mode="source"
    local cmd=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --configure)
                mode="configure"
                shift
                ;;
            --run)
                mode="run"
                cmd="${2:-}"
                if [[ -z "$cmd" ]]; then
                    echo "Error: --run requires a command argument" >&2
                    exit 1
                fi
                shift 2
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                show_usage
                exit 1
                ;;
        esac
    done

    case "$mode" in
        source)
            local existing_id
            existing_id=$(find_cypress_terminal)
            if [[ -n "$existing_id" ]]; then
                echo "Found existing '$TERMINAL_NAME' terminal, reusing it..."
                run_in_existing_terminal "source ./export-env.sh && echo '✅ Environment reloaded.'"
            else
                echo "Opening new '$TERMINAL_NAME' terminal..."
                open_with_source
            fi
            ;;
        configure)
            local existing_id
            existing_id=$(find_cypress_terminal)
            if [[ -n "$existing_id" ]]; then
                echo "Found existing '$TERMINAL_NAME' terminal, running configure-env.sh..."
                run_in_existing_terminal "./configure-env.sh && source ./export-env.sh && echo '' && echo '✅ Environment reconfigured.'"
            else
                echo "Opening new '$TERMINAL_NAME' terminal with configuration..."
                open_with_configure
            fi
            ;;
        run)
            local existing_id
            existing_id=$(find_cypress_terminal)
            if [[ -n "$existing_id" ]]; then
                echo "Running command in '$TERMINAL_NAME' terminal: $cmd"
                run_in_existing_terminal "$cmd"
            else
                echo "No '$TERMINAL_NAME' terminal found. Opening new one first..."
                open_with_source
                sleep 1
                run_in_existing_terminal "$cmd"
            fi
            ;;
    esac

    echo "Done."
}

main "$@"

