#!/usr/bin/env bash
# Open a named Terminal window for Cypress testing on Linux
# Usage:
#   ./open-cypress-terminal-linux.sh                    # Source export-env.sh
#   ./open-cypress-terminal-linux.sh --configure        # Run configure-env.sh interactively
#   ./open-cypress-terminal-linux.sh --run "command"    # Run a command in the Cypress Tests terminal

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

# Detect available terminal emulator
detect_terminal() {
    if command -v gnome-terminal &>/dev/null; then
        echo "gnome-terminal"
    elif command -v konsole &>/dev/null; then
        echo "konsole"
    elif command -v xfce4-terminal &>/dev/null; then
        echo "xfce4-terminal"
    elif command -v xterm &>/dev/null; then
        echo "xterm"
    else
        echo ""
    fi
}

# Open terminal with gnome-terminal
open_gnome_terminal() {
    local cmd="$1"
    gnome-terminal --title="$TERMINAL_NAME" -- bash -c "cd '$CYPRESS_DIR' && $cmd; exec bash"
}

# Open terminal with konsole
open_konsole() {
    local cmd="$1"
    konsole --new-tab -p tabtitle="$TERMINAL_NAME" -e bash -c "cd '$CYPRESS_DIR' && $cmd; exec bash"
}

# Open terminal with xfce4-terminal
open_xfce4_terminal() {
    local cmd="$1"
    xfce4-terminal --title="$TERMINAL_NAME" -e "bash -c 'cd \"$CYPRESS_DIR\" && $cmd; exec bash'"
}

# Open terminal with xterm
open_xterm() {
    local cmd="$1"
    xterm -T "$TERMINAL_NAME" -e "cd '$CYPRESS_DIR' && $cmd; exec bash" &
}

# Open terminal based on detected emulator
open_terminal() {
    local cmd="$1"
    local terminal
    terminal=$(detect_terminal)

    if [[ -z "$terminal" ]]; then
        echo "Error: No supported terminal emulator found" >&2
        echo "Please install one of: gnome-terminal, konsole, xfce4-terminal, xterm" >&2
        exit 1
    fi

    echo "Using terminal: $terminal"

    case "$terminal" in
        gnome-terminal) open_gnome_terminal "$cmd" ;;
        konsole) open_konsole "$cmd" ;;
        xfce4-terminal) open_xfce4_terminal "$cmd" ;;
        xterm) open_xterm "$cmd" ;;
    esac
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
            echo "Opening '$TERMINAL_NAME' terminal..."
            open_terminal "source ./export-env.sh && echo '✅ Environment loaded from export-env.sh' && echo 'You can now run Cypress tests.'"
            ;;
        configure)
            echo "Opening '$TERMINAL_NAME' terminal with configuration..."
            open_terminal "./configure-env.sh && source ./export-env.sh && echo '' && echo '✅ Environment configured and loaded.'"
            ;;
        run)
            echo "Opening '$TERMINAL_NAME' terminal and running: $cmd"
            open_terminal "source ./export-env.sh && $cmd"
            ;;
    esac

    echo "Done."
}

main "$@"

