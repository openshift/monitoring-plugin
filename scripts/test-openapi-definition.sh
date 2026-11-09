#!/usr/bin/env bash

set -euo pipefail

make generate-openapi
[ $(git status --porcelain=1 | wc -l) -ne 0 ] && exit 1
exit 0
