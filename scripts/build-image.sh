#!/usr/bin/env bash

set -euo pipefail

PREFER_PODMAN="${PREFER_PODMAN:-1}"
PUSH="${PUSH:-0}"
TAG="${TAG:-v1.0.0}"
REGISTRY_ORG="${REGISTRY_ORG:-openshift-observability-ui}"
DOCKER_FILE_NAME="${DOCKER_FILE_NAME:-Dockerfile.dev}"
REPO="${REPO:-monitoring-plugin}"

# Define ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
ENDCOLOR='\033[0m' 

# Prompt user for TAG 
read -p "$(echo -e "${RED}Enter a value for TAG [${TAG}]: ${ENDCOLOR}")" USER_TAG
if [ -n "$USER_TAG" ]; then
  TAG="$USER_TAG"
fi

if [[ -x "$(command -v podman)" && $PREFER_PODMAN == 1 ]]; then
    OCI_BIN="podman"
else
    OCI_BIN="docker"
fi

BASE_IMAGE="quay.io/${REGISTRY_ORG}/${REPO}"
IMAGE=${BASE_IMAGE}:${TAG}

echo_vars() {
    echo "Environmental Variables set to : "
    echo -e "${GREEN} PREFER_PODMAN: ${ENDCOLOR} ${PREFER_PODMAN}"
    echo -e "${GREEN} PUSH: ${ENDCOLOR} ${PUSH}"
    echo -e "${GREEN} TAG: ${ENDCOLOR} ${TAG}"
    echo -e "${GREEN} REGISTRY_ORG: ${ENDCOLOR} ${REGISTRY_ORG}"
    echo -e "${GREEN} DOCKER_FILE_NAME: ${ENDCOLOR} ${DOCKER_FILE_NAME}"
    echo -e "${GREEN} REPO: ${ENDCOLOR}: ${REPO}"
    echo -e "${GREEN} IMAGE: ${ENDCOLOR}: ${IMAGE}"
}
echo_vars

# Prompt use it check env vars before proceeding to build 
read -r -p "Are the environmental variables correct [y/N] " response
if [[ "$response" =~ ^([nN][oO])$ ]]
then
    exit 0
fi

# Build
echo -e "${GREEN} Linting... ${ENDCOLOR}"
make lint-backend

echo -e "${GREEN} Building image '${IMAGE}' with ${OCI_BIN} ${ENDCOLOR}"
$OCI_BIN build -t $IMAGE --platform=linux/amd64 -f $DOCKER_FILE_NAME .

if [[ $PUSH == 1 ]]; then 
    $OCI_BIN push $IMAGE
fi
