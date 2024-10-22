#!/usr/bin/env bash


# Replace the plugin name in the package.json for the custom build actions
sed -i 's/"name": "monitoring-plugin",/"name": "monitoring-console-plugin",/g' web/package.json
# Rename the translation files to the correct plugin
cd web/locales/ && for dir in *; do if cd $dir; then  for filename in *; do mv plugin__monitoring-plugin.json plugin__monitoring-console-plugin.json; done; cd ..; fi; done && cd ../..
