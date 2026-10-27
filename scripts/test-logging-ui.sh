#!/usr/bin/env bash

set -o nounset
set -o errexit
set -o pipefail

# Runs the mocked logging view Cypress suites (cypress.logging.config.ts) against
# the webpack test harness on localhost:9003. No cluster is required.
# Cypress screenshots are copied to ${ARTIFACT_DIR} when it is set (CI).

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
port=9003

# Stop the harness dev server and copy Cypress screenshots. Also runs on
# cancellation, otherwise a stale server keeps holding port 9003.
# (video is off in cypress.logging.config.ts, so only screenshots are collected.)
cleanup() {
    pkill -P $$ 2>/dev/null || true
    pkill -f webpack.logging.config.ts 2>/dev/null || true
    pkill -f "ts-node.*webpack" 2>/dev/null || true
    wait 2>/dev/null || true
    [ -n "${ARTIFACT_DIR:-}" ] || return 0
    if [ -d "${repo_root}/web/cypress/screenshots/" ]; then
      cp -r "${repo_root}/web/cypress/screenshots/" "${ARTIFACT_DIR}/screenshots"
    fi
    if [ -f /tmp/webpack-harness.log ]; then
      cp /tmp/webpack-harness.log "${ARTIFACT_DIR}/webpack-harness.log" 2>/dev/null || true
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export NO_COLOR=1
# CI images pre-bake the Cypress binary at /tmp/Cypress; locally keep the default
# cache, otherwise Cypress refuses to start (executable not found).
[ -d /tmp/Cypress ] && export CYPRESS_CACHE_FOLDER=/tmp/Cypress

cd "${repo_root}/web"

# Skip revisions carrying this script without the logging test harness.
if [[ ! -f cypress.logging.config.ts ]] || ! grep -q '"start:logging-tests"' package.json; then
  echo "Skipping: logging test harness not present in this source revision."
  exit 0
fi

npm install

# Start the logging view test harness, a webpack dev server on localhost:9003.
npm run start:logging-tests > /tmp/webpack-harness.log 2>&1 &

# Wait up to 5 minutes for the harness to accept connections.
for _ in $(seq 1 150); do (exec 3<>/dev/tcp/127.0.0.1/${port}) 2>/dev/null && break; sleep 2; done
(exec 3<>/dev/tcp/127.0.0.1/${port}) 2>/dev/null || {
  echo "ERROR: logging test harness did not become ready on port ${port}"
  exit 1
}

# Run the Cypress tests. The EXIT trap stops the harness afterwards: npm does
# not reliably forward signals to the webpack child, so both are killed.
npx cypress run --config-file cypress.logging.config.ts --browser chrome
