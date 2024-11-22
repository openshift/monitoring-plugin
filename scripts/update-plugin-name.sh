#!/usr/bin/env bash


# Replace the plugin name in the package.json for the custom build actions
sed -i 's/"name": "monitoring-plugin",/"name": "monitoring-console-plugin",/g' web/package.json

# Replace the plugin translation namespace in the plugin-manifest.json for the custom build actions
sed -i 's/%plugin__monitoring-plugin~/%plugin_monitoring-console-plugin~/g' config/plugin-manifest.json

# Replace the plugin name in the plugin-manifest.json for the custom build actions
sed -i 's/"name": "monitoring-plugin",/"name": "monitoring-console-plugin",/g' config/plugin-manifest.json

# Rename the translation files to the correct plugin
cd web/locales/ && for dir in *; do if cd $dir; then  for filename in *; do mv plugin__monitoring-plugin.json plugin__monitoring-console-plugin.json; done; cd ..; fi; done && cd ../..
