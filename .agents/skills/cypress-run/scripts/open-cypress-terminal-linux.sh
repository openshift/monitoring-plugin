#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TERMINAL_NAME="Cypress Tests"

find_repo_root() {
    local candidate="$SCRIPT_DIR"
    while [[ "$candidate" != "/" ]]; do
        if [[ -f "$candidate/AGENTS.md" && -d "$candidate/web/cypress" ]]; then
            printf '%s\n' "$candidate"
            return 0
        fi
        candidate="$(dirname -- "$candidate")"
    done
    echo "Error: could not locate the repository root from $SCRIPT_DIR" >&2
    return 1
}

REPO_ROOT="$(find_repo_root)"
CYPRESS_DIR="$REPO_ROOT/web/cypress"

show_usage() {
    printf '%s\n' \
        "Usage: $(basename "$0") [--configure | --run <command>]" \
        "" \
        "Without arguments, open a terminal and source web/cypress/export-env.sh." \
        "  --configure      Run configure-env.sh, then source export-env.sh." \
        "  --run <command>  Source export-env.sh and run the command from web/." \
        "  --help           Show this help."
}

detect_terminal() {
    local terminal
    for terminal in gnome-terminal konsole xfce4-terminal xterm; do
        if command -v "$terminal" >/dev/null 2>&1; then
            printf '%s\n' "$terminal"
            return 0
        fi
    done
    return 1
}

build_script() {
    local mode=$1
    case "$mode" in
    source)
        printf 'cd "$1" || exit; if [[ ! -f export-env.sh ]]; then echo "Missing web/cypress/export-env.sh; run with --configure first." >&2; exec bash; fi; source ./export-env.sh; echo "Cypress environment loaded."; exec bash'
        ;;
    configure)
        printf 'cd "$1" || exit; ./configure-env.sh && source ./export-env.sh; status=$?; echo "Configuration exited with status $status."; exec bash'
        ;;
    run)
        printf 'cd "$1/.." || exit; if [[ ! -f cypress/export-env.sh ]]; then echo "Missing web/cypress/export-env.sh; run with --configure first." >&2; exec bash; fi; source cypress/export-env.sh; bash -lc "$2"; status=$?; echo "Command exited with status $status."; exec bash'
        ;;
    esac
}

launch_terminal() {
    local terminal=$1
    local script=$2
    local command=${3-}
    case "$terminal" in
    gnome-terminal)
        gnome-terminal --title="$TERMINAL_NAME" -- bash -lc "$script" bash "$CYPRESS_DIR" "$command"
        ;;
    konsole)
        konsole --new-tab -p tabtitle="$TERMINAL_NAME" -e bash -lc "$script" bash "$CYPRESS_DIR" "$command"
        ;;
    xfce4-terminal)
        local invocation
        printf -v invocation 'bash -lc %q bash %q %q' "$script" "$CYPRESS_DIR" "$command"
        xfce4-terminal --title="$TERMINAL_NAME" --command="$invocation"
        ;;
    xterm)
        xterm -T "$TERMINAL_NAME" -e bash -lc "$script" bash "$CYPRESS_DIR" "$command" &
        ;;
    esac
}

main() {
    local mode=source
    local command=""
    case "${1-}" in
    "") ;;
    --configure)
        mode=configure
        [[ $# -eq 1 ]] || { show_usage >&2; return 2; }
        ;;
    --run)
        [[ $# -eq 2 && -n "${2-}" ]] || { show_usage >&2; return 2; }
        mode=run
        command=$2
        ;;
    --help | -h)
        show_usage
        return 0
        ;;
    *)
        show_usage >&2
        return 2
        ;;
    esac

    local terminal
    terminal="$(detect_terminal)" || {
        echo "Error: no supported terminal emulator found (gnome-terminal, konsole, xfce4-terminal, or xterm)." >&2
        return 1
    }

    local script
    script="$(build_script "$mode" "$command")"
    launch_terminal "$terminal" "$script" "$command"
    echo "Opened '$TERMINAL_NAME' with $terminal."
}

main "$@"
