#!/usr/bin/env bash

set -euo pipefail

PREFER_PODMAN="${PREFER_PODMAN:-1}"
PUSH="${PUSH:-0}"
TAG="${TAG:-v1.0.0}"
REGISTRY_ORG="${REGISTRY_ORG:-openshift-observability-ui}"
DOCKER_FILE_NAME="${DOCKER_FILE_NAME:-Dockerfile.dev}"

if [[ -x "$(command -v podman)" && $PREFER_PODMAN == 1 ]]; then
    OCI_BIN="podman"
else
    OCI_BIN="docker"
fi

BASE_IMAGE="quay.io/${REGISTRY_ORG}/monitoring-plugin"
IMAGE=${BASE_IMAGE}:${TAG}

echo "Building image '${IMAGE}' with ${OCI_BIN}"
$OCI_BIN build -t $IMAGE --platform=linux/amd64 -f $DOCKER_FILE_NAME .

if [[ $PUSH == 1 ]]; then
    $OCI_BIN push $IMAGE
fi
