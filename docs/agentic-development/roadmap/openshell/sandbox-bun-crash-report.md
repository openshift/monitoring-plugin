# Sandbox Issue Report: Bun Segfault in Openshell Sandbox

> **Deprecated**: This report documents a Bun runtime crash specific to the openshell-based sandbox approach, which has been abandoned. The production sandbox uses **Docker** instead — see [docs/agentic-development/setup/docker-sandbox-guide.md](../../setup/docker-sandbox-guide.md). This report is preserved for historical reference and in case the openshell approach is revisited.

**Date:** 2026-04-14  
**Reporter:** David Rajnoha  
**Environment:** Openshell 0.0.19, Linux Kernel 6.18.13, x64 (sse42 popcnt avx avx2)

## Summary

Claude Code fails to start inside an openshell sandbox due to a Bun runtime segfault. Both the base image's bundled Bun (1.3.11) and the host's version (1.3.13) crash with the same error. The issue appears to be an incompatibility between Bun's runtime and the sandbox's security restrictions (seccomp/landlock).

## Steps to Reproduce

1. Create a sandbox:
   ```bash
   openshell sandbox create --name my-project --provider gcp-adc --provider my-github --upload ".:/sandbox" --policy ./sandbox-policy.yaml
   ```

2. Connect and run Claude:
   ```bash
   openshell sandbox connect my-project
   cd /sandbox
   claude
   ```

## Observed Behavior

```
Bun v1.3.11 (0d72d5a9) Linux x64 (baseline)
Linux Kernel v6.18.13 | glibc v2.39
CPU: sse42 popcnt avx avx2
Args: "claude"
Features: jsc 
Elapsed: 2ms | User: 0ms | Sys: 4ms
RSS: 33.56MB | Peak: 9.54MB | Commit: 33.56MB | Faults: 1

panic(main thread): Segmentation fault at address 0xBBADBEEF
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
Illegal instruction (core dumped)
```

The crash report link: https://bun.report/1.3.11/B_10d72d5aAggggC+ypRktvoBq/5luGko7luGq92luGktvoB4qyxkFktvoBkk27jFktvoBqhqtvEktvoBi2ptvE02rm6Cozxl6Cy8wK0oxK6ivl6CA2AjxgpqkC

## What Was Tried

| Attempt | Result |
|---|---|
| Run `claude` from base image (Bun 1.3.11) | Segfault at 0xBBADBEEF |
| Pull newer base image and recreate sandbox | Same image/version, same crash |
| Upload host Claude binary (Bun 1.3.13) to sandbox | Same segfault |
| `npm install -g @anthropic-ai/claude-code@latest` | EACCES — sandbox user can't write to `/usr/lib/node_modules/` |
| `curl -fsSL https://bun.sh/install \| bash` | `/dev/null` permission denied, `unzip` not available |

## Root Cause Analysis

- The `0xBBADBEEF` address is a sentinel value, suggesting Bun deliberately crashes when it detects an unsupported or restricted environment (likely seccomp filters or landlock restrictions blocking syscalls Bun requires).
- This is NOT a CPU compatibility issue — the same binary runs fine on the host with the same CPU.
- This is NOT a Bun version issue — both 1.3.11 and 1.3.13 exhibit the same behavior.
- The sandbox security layer (seccomp/landlock/process restrictions) cannot be modified at runtime — only `network_policies` support hot-reload.

## Potential Solutions

1. **Create a claude provider and use `-- claude` flag** when creating the sandbox. This may configure the sandbox environment specifically for Claude (e.g., relaxed seccomp profile for Bun). This was not attempted because no claude provider was configured.

2. **Install Claude Code via npm to a user-writable directory** (uses Node.js instead of Bun):
   ```bash
   npm install --prefix ~/claude-local @anthropic-ai/claude-code@latest
   ~/claude-local/node_modules/.bin/claude
   ```
   This requires `registry.npmjs.org` in the network policy (already configured).

3. **Use `npx`** to run without installing:
   ```bash
   npx @anthropic-ai/claude-code@latest
   ```

4. **Update the base image** (`ghcr.io/nvidia/openshell-community/sandboxes/base:latest`) to include a Bun version compatible with the sandbox security profile, or switch Claude Code's runtime to Node.js in the image.

## Current Sandbox Configuration

- **Sandbox name:** my-project
- **Base image:** ghcr.io/nvidia/openshell-community/sandboxes/base:latest
- **Providers:** gcp-adc (generic), my-github (github)
- **Network policy:** anthropic_api, google_oauth, github, npm_registry, bun_install
- **Process:** runs as `sandbox` user (non-root)

## Recommended Next Step

Configure a claude provider (`openshell provider create --type anthropic ...`) and recreate the sandbox with `-- claude` to let openshell handle the Claude runtime environment properly.
