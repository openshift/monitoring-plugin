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
