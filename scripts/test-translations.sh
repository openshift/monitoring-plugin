#!/usr/bin/env bash

cd web && npm run i18n
[ $(git status --porcelain=1 | wc -l) -ne 0 ] && exit 1
exit 0
