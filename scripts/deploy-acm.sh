#!/usr/bin/env bash

# Assumes being run from project home directory
sed -i 's/"name": "monitoring-plugin",/"name": "monitoring-console-plugin",/g' web/package.json
make build-frontend
make deploy


if [[ "$OSTYPE" == "darwin"* ]]
then
    osascript -e 'display notification "Plugin Deployed" with title "Monitoring Plugin"'
fi

sed -i 's/"name": "monitoring-console-plugin",/"name": "monitoring-plugin",/g' web/package.json
