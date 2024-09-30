#!/usr/bin/env bash

set -euo pipefail

# Terminal output colors
GREEN='\033[0;32m'
ENDCOLOR='\033[0m' # No Color
RED='\033[0;31m'

# Environment Variables 
PREFER_PODMAN="${PREFER_PODMAN:-1}"
PUSH="${PUSH:-0}"
TAG="${TAG:-v1.0.0}"
REGISTRY_ORG="${REGISTRY_ORG:-openshift-observability-ui}"
BASE_IMAGE="quay.io/${REGISTRY_ORG}/monitoring-plugin"
IMAGE=${BASE_IMAGE}:${TAG}

printf "${GREEN}Environment Varibles ${ENDCOLOR}\n"
printf "PREFER_PODMAN = ${PREFER_PODMAN}\n"
printf "PUSH = ${PUSH}\n"
printf "TAG = ${TAG}\n"
printf "REGISTRY_ORG = ${REGISTRY_ORG}\n"
printf "IMAGE = ${IMAGE}\n"

# User Input to confirm environment variables before proceeding.
read -p "$(printf "Do these env variables look right? (Y/N): ")" confirm && [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]] || exit 1

# remove "web/dist" from .dockerignore so Dockerfil.mac has access to it 
sed -i '' '/web\/dist/d' .dockerignore

# image build/push using Dockerfile.mac which omits yarn install/build and obtains it from web/dist
if [[ -x "$(command -v podman)" && $PREFER_PODMAN == 1 ]]; then
    OCI_BIN="podman"
else
    OCI_BIN="docker"
fi

echo "Building image '${IMAGE}' with ${OCI_BIN}"
$OCI_BIN build -t $IMAGE -f Dockerfile.mac --platform=linux/amd64 .

if [[ $PUSH == 1 ]]; then
    $OCI_BIN push $IMAGE
fi

# clean up, add "web/dist" back to .dockerignore 
echo "web/dist" >> .dockerignore




