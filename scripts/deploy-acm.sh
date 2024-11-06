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
    printf "${YELLOW}Updateing plugin-name ${ENDCOLOR}\n"
    yq -i '.plugin.acm.enabled = true' charts/openshift-console-plugin/values.yaml
    make update-plugin-name
    export I18N_NAMESPACE='plugin__monitoring-console-plugin'

    printf "${YELLOW}Building Frontend${ENDCOLOR}\n"
    make build-frontend
fi


export DOCKER_FILE_NAME=Dockerfile.acm
make deploy

if [[ "$OSTYPE" == "darwin"* ]]
then
    osascript -e 'display notification "Plugin Deployed" with title "Monitoring Plugin"'
fi


if [[ "$OSTYPE" == "darwin"* ]]
then
    # rollback changes
    printf "${YELLOW}Replacing in package.json and values.yaml${ENDCOLOR}\n"
    sed -i 's/"name": "monitoring-console-plugin",/"name": "monitoring-plugin",/g' web/package.json
    printf "${YELLOW}Renaming translations to the original plugin name${ENDCOLOR}\n"
    yq -i '.plugin.acm.enabled = false' charts/openshift-console-plugin/values.yaml
    cd web/locales/ && for dir in *; do if cd $dir; then  for filename in *; do mv plugin__monitoring-console-plugin.json plugin__monitoring-plugin.json; done; cd ..; fi; done
fi
