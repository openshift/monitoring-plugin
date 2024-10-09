#!/usr/bin/env bash

if ! [ -x "$(command -v yq)" ]; then
  echo "yq required to run script"
  exit 1
fi

# Assumes being run from project home directory
export PLUGIN_NAME="monitoring-console-plugin"
sed -i 's/"name": "monitoring-plugin",/"name": "monitoring-console-plugin",/g' web/package.json
yq -i '.plugin.acm.enabled = true' charts/openshift-console-plugin/values.yaml
make build-frontend
make deploy


if [[ "$OSTYPE" == "darwin"* ]]
then
    osascript -e 'display notification "Plugin Deployed" with title "Monitoring Plugin"'
fi

sed -i 's/"name": "monitoring-console-plugin",/"name": "monitoring-plugin",/g' web/package.json
yq -i '.plugin.acm.enabled = false' charts/openshift-console-plugin/values.yaml
