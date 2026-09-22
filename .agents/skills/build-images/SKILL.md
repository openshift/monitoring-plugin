---
name: build-images
description: Build the monitoring-plugin and monitoring-console-plugin development images with a unique tag. Use when the user asks to build both repository images.
---

# Build images

Run this workflow only when the user explicitly asks to build the images. The build script pushes by default; do not change that behavior without a separate request.

1. Read `Makefile` and `scripts/build-image.sh` before running the build so current image names and environment defaults take precedence over this skill.
2. Use Podman when available. Determine `REGISTRY_ORG` from the environment, falling back to the build script default.
3. If the user did not provide a tag, derive the base tag from a Jira-style current branch name. If that is not possible, ask for a tag.
4. Query both repositories before selecting the tag:

   ```bash
   podman image ls --filter "reference=quay.io/${REGISTRY_ORG:-openshift-observability-ui}/monitoring-plugin*" --format '{{.Repository}}:{{.Tag}}'
   podman image ls --filter "reference=quay.io/${REGISTRY_ORG:-openshift-observability-ui}/monitoring-console-plugin*" --format '{{.Repository}}:{{.Tag}}'
   ```

5. Do not overwrite an existing tag. If the base exists, choose the next unused numeric suffix across both image names (`TAG-2`, `TAG-3`, and so on).
6. From the repository root, run both builds with the same tag:

   ```bash
   INTERACTIVE=0 TAG=<unique-tag> make build-image
   INTERACTIVE=0 TAG=<unique-tag> make build-dev-mcp-image
   ```

Stop on the first failure, preserve the error output, and report which build failed. Do not push any additional tags or retry with changed settings unless the user asks.
