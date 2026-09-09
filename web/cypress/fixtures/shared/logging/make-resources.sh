#!/bin/bash
set -euo pipefail
cd ./cypress/fixtures/shared/logging/openshift || exit 1

make resources
