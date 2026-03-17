---
name: build-images
description: 
parameters:
  - tag: The tag to be placed on the created images. This will typically be a jira ticket in the format of "letters-numbers" (ie. OU-1111).
allowed-tools: Bash(INTERACTIVE=0 TAG=* make build-image), Bash(INTERACTIVE=0 TAG=* make build-dev-mcp-image), Bash(podman image ls -f "reference=$REGISTRY_ORG/monitoring-plugin*"), Bash(podman image ls -f "reference=$REGISTRY_ORG/monitoring-console-plugin*")
---

## Context

- Prefer podman when running image related commands over docker.
- All images that have currently been built for the monitoring plugin: !`podman image ls -f "reference=$REGISTRY_ORG/monitoring-plugin*"`
- All images that have currently been built for the monitoring console plugin: !`podman image ls -f "reference=$REGISTRY_ORG/monitoring-plugin*"`
- Scripting used: @Makefile @scripts/build-image.sh

## Your task

Determine an appropriate non-duplicate image tag to use. If the current git branch is a jira issue then you should use that as the base. If the tag is not already used then use it directly. If it has already been used, then add an additional index to the tag and increment one past the highest existing value. For example, if tags [OU-1111, OU-1111-2, and OU-1111-3] already exist then the the non-duplicate tag should be OU-1111-4. Do not attempt to use the same tag and override the previous build.

Run the `make build-image` and `make build-dev-mcp-image` commands with the INTERACTIVE=0 and TAG env variables set.

If the image fails to build, show the error to the user and offer to debug
