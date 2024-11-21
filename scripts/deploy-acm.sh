#!/usr/bin/env bash
# Terminal output colors
YELLOW='\033[0;33m'
ENDCOLOR='\033[0m' # No Color
RED='\033[0;31m'


if ! [ -x "$(command -v yq)" ]; then
    printf "${RED}yq required to run make deploy-acm ${ENDCOLOR}\n"
  exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]
then
    # due to mac limitation with installing packages inside of dockerfiles, builds of the frontend must be done outside the dockerfile.
    printf "${YELLOW}Enabling ACM plugin-name ${ENDCOLOR}\n"
    yq -i '.plugin.features.acm.enabled = true' charts/openshift-console-plugin/values.yaml
fi

export DOCKER_FILE_NAME=Dockerfile.mcp
make deploy

if [[ "$OSTYPE" == "darwin"* ]]
then
    # rollback changes
    printf "${YELLOW}Disabling ACM features${ENDCOLOR}\n"
    yq -i '.plugin.features.acm.enabled = false' charts/openshift-console-plugin/values.yaml
    osascript -e 'display notification "Plugin Deployed" with title "Monitoring Plugin"'
fi
