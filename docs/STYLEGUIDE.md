# Monitoring Plugin Style Guide

This document defines the monitoring-plugin repository style guides. It is a living document and should be updated as style decisions are made

## File Naming Conventions

| File type                      | Convention                            | Examples                                                           |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| React component files (`.tsx`) | PascalCase                            | `AlertsPage.tsx`, `SilenceForm.tsx`, `DashboardListPage.tsx`       |
| React Hook files               | camelCase with `use` prefix           | `useAlerts.ts`, `useLegacyDashboards.ts`, `usePerspective.tsx`     |
| All other `.ts` files          | kebab-case                            | `filter-rules.ts`, `dashboard-api.ts`, `sort-utils.ts`             |
| JS Spec / test files           | Match source file stem convention     | `filter-rules.spec.ts`, `AlertsPage.spec.tsx`, `useAlerts.spec.ts` |
| Go files                       | snake_case                            | `plugin_handler.go`, `proxy.go`                                    |
| Go test files                  | snake_case                            | `server_test.go`                                                   |
| Shell scripts                  | kebab-case                            | `build-image.sh`, `start-console.sh`                               |
| CSS / SCSS                     | kebab-case                            | `query-browser.scss`, `dashboard-page.css`                         |
| Config files (JSON, YAML)      | kebab-case                            | `acm-alerting.patch.json`                                          |
| Dockerfiles                    | `Dockerfile` or `Dockerfile.<suffix>` | `Dockerfile`, `Dockerfile.dev`, `Dockerfile.mcp`                   |
| Folder names                   | kebab-case                            | `alert-rules-page/`, `legacy-dashboards/`, `perses-dashboards/`    |

## Existing files

Existing files that predate this styleguide are not required to be renamed immediately. New files and renamed files must conform. Existing
non-conforming files will be migrated incrementally over time without disrupting CI.

New rules:

### 1. Use function for component definition

The displayName of a react component is often used in devtools and the like. When defining a component as a `function` it is able to use the function name, but when defining a function as an `arrow function` you need to add an additional `.displayName` to the variable.

Needing to remember to add a duplicate `.displayName` to an `arrow function` component is extra mental overhead, so we should use `function` definitions instead.

### 2. No default exports

Do not allow default exports from files, instead require each function, variable, etc. to be exported manually

### 3. Require Page files to only export react components ending with Page

With our component structure and the need to export page modules in package.json and use their exported modules in `.patch.json` we should have consistent module exports as well as file names

### 4. Avoid Higher-order Components

Avoid usage of higher order components like `withFallback` and instead prefer manually wrapping components and context/hooks to deliver data

### 5. React Prop names

camelCase for props unless the prop is a React Component in which case it should be PascalCase

### 6. `react/self-closing-comp`

Always self close tags have no children

Others for consideration:

- Barrel Files
- export all things at bottom of file (easy to find what each file exports)
- Require commit signing
- Require conventional commits https://www.conventionalcommits.org/en/v1.0.0/
