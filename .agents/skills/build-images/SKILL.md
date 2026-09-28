---
name: build-images
description: Build the monitoring-plugin and monitoring-console-plugin development images with a unique tag. Use when the user asks to build both repository images.
---

# Build images

Run this workflow only when the user explicitly asks to build the images. The build script pushes by default; do not change that behavior without a separate request.

1. Read `Makefile` and `scripts/build-image.sh` before running the build so current image names and environment defaults take precedence over this skill.
2. Select the container engine as `scripts/build-image.sh` does. Determine `REGISTRY_ORG` from the environment, falling back to the build script default.
3. If the user did not provide a tag, derive the base tag from a Jira-style current branch name. If that is not possible, ask for a tag.
4. Query both repositories before selecting the tag:

   ```bash
   if [[ -x "$(command -v podman)" && ${PREFER_PODMAN:-1} == 1 ]]; then
       OCI_BIN=podman
   else
       OCI_BIN=docker
   fi
   "$OCI_BIN" image ls --filter "reference=quay.io/${REGISTRY_ORG:-openshift-observability-ui}/monitoring-plugin*" --format '{{.Repository}}:{{.Tag}}'
   "$OCI_BIN" image ls --filter "reference=quay.io/${REGISTRY_ORG:-openshift-observability-ui}/monitoring-console-plugin*" --format '{{.Repository}}:{{.Tag}}'
   ```

5. For each candidate tag, query Quay for the exact active tag in both repositories with `GET https://quay.io/api/v1/repository/${REGISTRY_ORG:-openshift-observability-ui}/<repository>/tag/?specificTag=<URL-encoded-tag>&onlyActiveTags=true` (authenticate if needed). Treat any matching remote tag as taken. Choose the next unused numeric suffix across both image names (`TAG-2`, `TAG-3`, and so on) if the base exists locally or remotely. Stop if either remote query fails; a failed lookup does not mean the tag is free.
6. Before pushing, verify that Quay has an enabled organization or repository [immutability policy](https://docs.projectquay.io/quay_jtbd-administer.html#immutable-tags-overview) matching the selected tag for **both** repositories. The policy must make each tag immutable on its first push so a concurrent push cannot move it. Stop if this cannot be verified; the remote lookup alone does not reserve a tag, and making it immutable after pushing leaves a race.
7. From the repository root, run both builds with the same tag:

   ```bash
   INTERACTIVE=0 TAG=<unique-tag> make build-image
   INTERACTIVE=0 TAG=<unique-tag> make build-dev-mcp-image
   ```

Stop on the first failure, preserve the error output, and report which build failed. Do not push any additional tags or retry with changed settings unless the user asks.
