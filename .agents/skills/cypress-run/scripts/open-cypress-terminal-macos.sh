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
        "Without arguments, open or reuse Terminal and source export-env.sh." \
        "  --configure      Run configure-env.sh, then source export-env.sh." \
        "  --run <command>  Source export-env.sh and run the command from web/." \
        "  --help           Show this help."
}

build_command() {
    local mode=$1
    local command=${2-}
    local inner
    case "$mode" in
    source)
        printf -v inner 'cd %q || exit; if [[ ! -f export-env.sh ]]; then echo %q >&2; exec bash; fi; source ./export-env.sh; echo %q; exec bash' \
            "$CYPRESS_DIR" \
            'Missing web/cypress/export-env.sh; run with --configure first.' \
            'Cypress environment loaded.'
        ;;
    configure)
        printf -v inner 'cd %q || exit; ./configure-env.sh && source ./export-env.sh; status=$?; echo "Configuration exited with status $status."; exec bash' "$CYPRESS_DIR"
        ;;
    run)
        printf -v inner 'cd %q || exit; if [[ ! -f cypress/export-env.sh ]]; then echo %q >&2; exec bash; fi; source cypress/export-env.sh; bash -lc %q; status=$?; echo "Command exited with status $status."; exec bash' \
            "$REPO_ROOT/web" \
            'Missing web/cypress/export-env.sh; run with --configure first.' \
            "$command"
        ;;
    esac
    printf 'bash -lc %q' "$inner"
}

run_in_terminal() {
    local command=$1
    osascript - "$TERMINAL_NAME" "$command" <<'APPLESCRIPT'
on run argv
    set terminalTitle to item 1 of argv
    set shellCommand to item 2 of argv
    tell application "Terminal"
        set targetWindow to missing value
        repeat with candidateWindow in windows
            if custom title of candidateWindow is terminalTitle then
                set targetWindow to candidateWindow
                exit repeat
            end if
        end repeat
        if targetWindow is missing value then
            do script shellCommand
            delay 0.5
            set custom title of front window to terminalTitle
        else
            do script shellCommand in targetWindow
        end if
        activate
    end tell
end run
APPLESCRIPT
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

    command="$(build_command "$mode" "$command")"
    run_in_terminal "$command"
    echo "Opened '$TERMINAL_NAME' in Terminal."
}

main "$@"
