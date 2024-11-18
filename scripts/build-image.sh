#!/usr/bin/env bash

set -euo pipefail

PREFER_PODMAN="${PREFER_PODMAN:-1}"
PUSH="${PUSH:-0}"
TAG="${TAG:-v1.0.0}"
REGISTRY_ORG="${REGISTRY_ORG:-openshift-observability-ui}"
DOCKER_FILE_NAME="${DOCKER_FILE_NAME:-Dockerfile.dev}"

# Terminal output colors
YELLOW='\033[0;33m'
ENDCOLOR='\033[0m' # No Color
RED='\033[0;31m'


# due to apple silicon limitation with installing npm packages inside amd64 images, builds of the frontend must be done outside the dockerfile.
if [[ "$OSTYPE" == "darwin"* ]] && [[ "$DOCKER_FILE_NAME" == "Dockerfile.mcp" ]]; then
    printf "${YELLOW}Updateing plugin-name ${ENDCOLOR}\n"
    make update-plugin-name
    export I18N_NAMESPACE='plugin__monitoring-console-plugin'

    printf "${YELLOW}Building Frontend${ENDCOLOR}\n"
    make build-frontend
fi

if [[ -x "$(command -v podman)" && $PREFER_PODMAN == 1 ]]; then
    OCI_BIN="podman"
else
    OCI_BIN="docker"
fi

BASE_IMAGE="quay.io/${REGISTRY_ORG}/monitoring-plugin"
IMAGE=${BASE_IMAGE}:${TAG}

make lint-backend

echo "Building image '${IMAGE}' with ${OCI_BIN}"
$OCI_BIN build -t $IMAGE --platform=linux/amd64 -f $DOCKER_FILE_NAME .

if [[ $PUSH == 1 ]]; then
    $OCI_BIN push $IMAGE
fi


# Rollback local changes made
if [[ "$OSTYPE" == "darwin"* ]] && [[ "$DOCKER_FILE_NAME" == "Dockerfile.mcp" ]]; then
    printf "${YELLOW}Replacing in package.json and values.yaml${ENDCOLOR}\n"
    sed -i 's/"name": "monitoring-console-plugin",/"name": "monitoring-plugin",/g' web/package.json
    printf "${YELLOW}Renaming translations to the original plugin name${ENDCOLOR}\n"
    cd web/locales/ && for dir in *; do if cd $dir; then  for filename in *; do mv plugin__monitoring-console-plugin.json plugin__monitoring-plugin.json; done; cd ..; fi; done
fi
