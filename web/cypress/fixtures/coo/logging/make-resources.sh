#!/bin/bash
set -euo pipefail
cd ./cypress/fixtures/coo/logging/openshift || exit 1

make resources
