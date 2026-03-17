---
allowed-tools: Bash(git:*), Read, Write, Edit
argument-hint: <target-branch> [commit-hash]
description: Backport a feature or fix to a release branch with dependency adaptation
---

# Backport Feature to Release Branch

## Context

- Current branch: !`git branch --show-current`
- Target branch: $1
- Commit to backport: $2 (or HEAD if not specified)
- Latest commit info: !`git log -1 --format="%H %s"`
- Changed files: !`git show --name-only HEAD | tail -n +7`

## Dependency Version Differences

| Dependency   | Main (Latest) | release-4.21 | release-4.20 | release-4.19 | release-4.18 | release-4.17 | release-coo-0.5 | release-coo-0.4 |
| ------------ | ------------- | ------------ | ------------ | ------------ | ------------ | ------------ | --------------- | --------------- |
| PatternFly   | v6.x          | v6.x         | v6.x         | v6.x         | v5.x         | v4.x         | v6.x            | v5.x            |
| React Router | v6 compat     | v6 compat    | v6 compat    | v6 compat    | v5           | v5           | v6 compat       | v5              |
| Console SDK  | 4.19+         | 4.19         | 4.19         | 4.19         | 1.6.0        | 1.6.0        | 4.19            | 1.6.0           |

## Project Structure Differences

| Branch          | Frontend Location | Go Backend | Notes                             |
| --------------- | ----------------- | ---------- | --------------------------------- |
| release-4.14    | Root (`src/`)     | No         | Frontend-only plugin              |
| release-4.15    | Root (`src/`)     | No         | Frontend-only plugin              |
| release-4.16    | Root (`src/`)     | No         | Frontend-only plugin              |
| release-4.17+   | `web/`            | Yes        | Added Go backend (`pkg/`, `cmd/`) |
| release-coo-0.x | `web/`            | Yes        | Same structure as 4.17+           |

> **Note**: When backporting to release-4.16 or earlier, file paths must be adjusted from `web/src/` to `src/`.

## PatternFly v6 → v5 Transformations

When targeting release-4.18 or earlier (or release-coo-0.4):

```typescript
// v6 Dropdown (main)
import { Dropdown, DropdownItem, MenuToggle } from "@patternfly/react-core";

<Dropdown
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  toggle={(toggleRef) => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)}>
      {selected}
    </MenuToggle>
  )}
>
  <DropdownItem>Option 1</DropdownItem>
</Dropdown>;

// v5 Dropdown (release branches)
import { Dropdown, DropdownItem, DropdownToggle } from "@patternfly/react-core";

<Dropdown
  isOpen={isOpen}
  onSelect={() => setIsOpen(false)}
  toggle={<DropdownToggle onToggle={setIsOpen}>{selected}</DropdownToggle>}
  dropdownItems={[<DropdownItem key="1">Option 1</DropdownItem>]}
/>;
```

Common v6 → v5 changes:
| v6 (main) | v5 (release) | Notes |
| ---------------------- | ------------------- | ---------------------------- |
| `<Panel>` | `<Card>` | Different wrapper components |
| `MenuToggle` | `DropdownToggle` | Dropdown API changed |
| `Dropdown` (new API) | `Dropdown` (legacy) | Props differ significantly |
| `Select` (typeahead) | `Select` (legacy) | Selection handling differs |
| `onOpenChange` | `onToggle` | Event handler naming |

## React Router v6 → v5 Transformations

When targeting release-4.18 or earlier (or release-coo-0.4):

```typescript
// v6 Navigation (main - using compat layer)
import {
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom-v5-compat";

const navigate = useNavigate();
navigate("/alerts");

const [searchParams, setSearchParams] = useSearchParams();
const filter = searchParams.get("filter");

// v5 Navigation (release branches)
import { useHistory, useLocation } from "react-router-dom";

const history = useHistory();
history.push("/alerts");

const location = useLocation();
const params = new URLSearchParams(location.search);
const filter = params.get("filter");
```

Common v6 → v5 changes:
| v6 (main) | v5 (release) | Notes |
| -------------------- | ----------------------- | --------------- |
| `useNavigate()` | `useHistory()` | Navigation hook |
| `navigate('/path')` | `history.push('/path')` | Navigation call |
| `useParams<Type>()` | `useParams()` + casting | Type handling |
| `<Routes>` | `<Switch>` | Route wrapper |
| `<Route element={}>` | `<Route component={}>` | Route rendering |
| `useSearchParams()` | `useLocation()` + parse | Query params |

## Your Task

Backport the specified commit to the target branch `$1`. Follow these steps:

### 1. Analyze the Commit

- Identify all changed files from the commit
- Categorize by type (components, hooks, translations, backend, etc.)
- Note any PatternFly, React Router, or Console SDK usage

### 2. Check Target Branch Dependencies

Run this command to compare versions:

```bash
git show $1:web/package.json | grep -E 'patternfly.react-core|react-router|dynamic-plugin-sdk":'
```

### 3. Identify Required Transformations

Based on the dependency differences table above:

- PatternFly v6 → v5 transformations (if targeting 4.18 or earlier, or coo-0.4)
- React Router v6 → v5 transformations (if targeting 4.18 or earlier, or coo-0.4)
- Path adjustments for 4.16 or earlier (web/src/ → src/)

### 4. Create Backport Branch and Apply Changes

```bash
git checkout $1
git checkout -b backport-<feature>-to-$1
```

### 5. Reinstall Dependencies

After switching branches, always reinstall:

```bash
cd web && rm -rf node_modules && npm install
```

### 6. Apply the Backport

Either cherry-pick (if clean) or manually apply with transformations:

```bash
# Clean cherry-pick
git cherry-pick <commit-hash>

# Or with conflicts - resolve manually then:
git cherry-pick --continue

# Abort if needed
git cherry-pick --abort
```

### 7. Verify

Run these commands to validate:

```bash
cd web
npm run lint
npm run lint:tsc
npm run test:unit
cd .. && make test-translations
make test-backend
```

### 8. Report Summary

Provide a summary of:

- Files modified
- Transformations applied (PF v6→v5, Router v6→v5, path changes)
- Any issues encountered
- Commands to push and create PR:

```bash
git push origin backport-<feature>-to-$1
# Then create PR targeting $1 branch
```

## File Categorization by Complexity

| Category      | Path Pattern             | Backport Complexity                |
| ------------- | ------------------------ | ---------------------------------- |
| Components    | `web/src/components/**`  | Medium-High (dependency sensitive) |
| Hooks         | `web/src/hooks/**`       | Medium                             |
| Store/Redux   | `web/src/store/**`       | Low-Medium                         |
| Contexts      | `web/src/contexts/**`    | Low-Medium                         |
| Translations  | `web/locales/**`         | Low                                |
| Backend (Go)  | `pkg/**`, `cmd/**`       | Low                                |
| Cypress Tests | `web/cypress/**`         | Medium                             |
| Config        | `web/*.json`, `Makefile` | High (version specific)            |

## Release Branch Ownership

| Branch Pattern    | Managed By | Use Case                       |
| ----------------- | ---------- | ------------------------------ |
| `release-4.x`     | CMO        | OpenShift core monitoring      |
| `release-coo-x.y` | COO        | Cluster Observability Operator |

## Common Backport Scenarios

### Simple Bug Fix

- Usually clean cherry-pick
- No dependency changes
- Just run tests

### New Component Feature

- Check for PatternFly component usage
- Verify console-extensions.json compatibility
- May need v6→v5 PatternFly transformations

### Dashboard/Perses Changes

- High dependency sensitivity
- Check @perses-dev/\* versions in target
- ECharts version compatibility

### Alerting/Incident Changes

- Check Alertmanager API compatibility
- Verify any new console extension types

### Translation Updates

- Usually clean backport
- Verify i18next key compatibility
- Run `make test-translations`

## Troubleshooting

### "Module not found" after backport

- Check if imported module exists in target branch version
- Verify package.json dependencies match

### TypeScript errors after adaptation

- Check type definitions between versions
- Use explicit typing where inference differs

### Test failures after backport

- Compare test utilities between versions
- Check for mock/fixture differences

### Build failures

- Verify webpack config compatibility
- Check for console plugin SDK breaking changes

## Backport PR Template

When creating the PR, use this template:

```markdown
## Backport of #<original-PR-number>

### Original Change

<Brief description of the feature or fix>

### Backport Target

- Branch: `$1`
- OpenShift Version: 4.x / COO x.y

### Adaptations Made

- [ ] PatternFly v6 → v5 components adapted
- [ ] React Router v6 → v5 hooks adapted
- [ ] Console SDK API adjustments
- [ ] No adaptations needed (clean cherry-pick)

### Testing

- [ ] `make lint-frontend` passes
- [ ] `make test-backend` passes
- [ ] `npm run test:unit` passes
- [ ] `make test-translations` passes
- [ ] Manual testing performed

### Notes

<Any additional context about the backport>
```

## Quick Reference Commands

```bash
# View commit to backport
git show <commit-hash>

# Compare file between branches
git diff $1:web/src/<file> main:web/src/<file>

# Check dependency versions in target
git show $1:web/package.json | grep -A 5 "patternfly"

# Interactive cherry-pick with edit
git cherry-pick -e <commit-hash>
```
