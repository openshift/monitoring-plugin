# Contributing to OpenShift Monitoring Plugin

Thank you for your interest in contributing to the OpenShift Monitoring Plugin! This document provides guidelines for contributing code, submitting pull requests, and maintaining code quality.

## Table of Contents

- [Getting Started](#getting-started)
- [Pull Request Process](#pull-request-process)
  - [PR Requirements](#pr-requirements)
  - [Labels and Review Process](#labels-and-review-process)
  - [Branch and Commit Guidelines](#branch-and-commit-guidelines)
- [Code Conventions](#code-conventions)
  - [Naming Conventions](#naming-conventions)
  - [React Component Patterns](#react-component-patterns)
  - [State Management](#state-management)
  - [TypeScript Best Practices](#typescript-best-practices)
- [Testing Requirements](#testing-requirements)
- [Internationalization (i18n)](#internationalization-i18n)
- [Troubleshooting](#troubleshooting)
- [Getting Help](#getting-help)

---

## Getting Started

### Development Environment

Before you start contributing, ensure you have the following tools installed:

- [Node.js 22+](https://nodejs.org/en/) and [npm](https://www.npmjs.com/)
- [Go 1.24+](https://go.dev/dl/)
- [oc CLI](https://mirror.openshift.com/pub/openshift-v4/clients/oc/)
- [podman 3.2.0+](https://podman.io) or [Docker](https://www.docker.com/)
- An OpenShift cluster (for testing)

### Local Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/openshift/monitoring-plugin.git
   cd monitoring-plugin
   ```

2. **Install dependencies**:

   ```bash
   make install
   ```

3. **Verify setup**:
   ```bash
   make lint-frontend
   make lint-backend
   ```

For detailed setup instructions, see [README.md](./README.md#local-development).

---

## Pull Request Process

This project uses [Prow](https://docs.prow.k8s.io/) for CI/CD automation. Pull requests require specific labels to be merged, which are applied based on reviews from team members.

### PR Requirements

1. **Title format**: `JIRA_ISSUE: [release-x.y] Description`

   - Example: `OU-1234: [release-4.19] Add support for custom dashboards`
   - Example: `COO-456: Add support for custom datasources`

2. **Before submitting**, run the following checks locally and address any errors:

   ```bash
   make lint-frontend    # ESLint and Prettier checks
   make lint-backend     # Go fmt and mod tidy
   make test-translations # Verify i18n keys
   make test-backend     # Go unit tests
   make test-frontend    # Jest unit tests
   ```

3. **Required checks must pass** in CI before merging.

### Labels and Review Process

The Prow bot manages labels based on reviews. The following labels are required for a PR to be merged:

| Label          | Description            | How to Obtain                                                                |
| -------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `/lgtm`        | Code review approval   | Wait for a reviewer to comment `/lgtm`, reviewers are automatically assigned |
| `/qe-approved` | QE verification passed | Applied when QE team reviews (if applicable)                                 |

### Example PR Review Flow

1. Contributor opens PR with proper title format
2. CI runs automatically (lint, tests, build)
3. Reviewer reviews code and comments `/lgtm`
4. If significant feature: QE team tests and applies `/qe-approved`
5. Prow bot merges the PR when all required labels are present

### Branch and Commit Guidelines

#### Branch Naming

Use descriptive branch names that reference the JIRA issue:

```
ou-1234-feature-description
coo-1234-fix-bug-description
ou-1234-refactor-component
```

#### Commit Messages

- Use the format from https://www.conventionalcommits.org/en/v1.0.0/
- Reference the JIRA issue if applicable
- Keep commits focused and atomic
- Prefer multiple focused commits over one large commit

**Good commit message**:

```
feat(alerts): add filter by severity

Add dropdown to filter alerts by severity level on the alerts page.
Users can now select critical, warning, or info severity filters.

Fixes OU-1234
```

**Avoid**:

```
fixed stuff
update
changes
```

---

## Code Conventions

### Naming Conventions

#### Components

| Type              | Convention                    | Example                                                                                   |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| React Components  | PascalCase                    | `AlertsDetailsPage`, `SilenceForm`, `QueryBrowser`, `LoadingBox`, `EmptyBox`, `StatusBox` |
| Page Components   | PascalCase with `Page` suffix | `MetricsPage`, `TargetsPage`                                                              |
| HOCs              | camelCase with `with` prefix  | `withFallback`                                                                            |
| Regular functions | camelCase                     | `formatAlertLabel`, `buildPromQuery`, `handleNamespaceChange`                             |

#### Files

| Type             | Convention                        | Example                                                                              |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| React Components | PascalCase                        | `MetricsPage.tsx`, `QueryBrowser.tsx`                                                |
| Utilities        | kebab-case                        | `safe-fetch-hook.ts`, `poll-hook.ts`                                                 |
| Types            | kebab-case or PascalCase          | `types.ts`, `AlertUtils.tsx`                                                         |
| Tests            | `.spec.ts` suffix                 | `MetricsPage.spec.tsx`, `safe-fetch-hook.spec.ts`, `format.spec.ts`, `utils.spec.ts` |
| Styles           | `.scss` suffix matching component | `query-browser.scss`                                                                 |

#### Types and Interfaces

| Type            | Convention                                       | Example                                                 |
| --------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Type aliases    | PascalCase                                       | `MonitoringResource`, `TimeRange`, `AlertSource`        |
| Interface names | PascalCase with Props suffix for component props | `SilenceFormProps`, `TypeaheadSelectProps`              |
| Enum values     | PascalCase or SCREAMING_SNAKE_CASE               | `AlertSource.Platform`, `ActionType.AlertingSetLoading` |

```typescript
// ✅ Good: Type definitions
export type MonitoringResource = {
  group: string;
  resource: string;
  abbr: string;
  kind: string;
  label: string;
  url: string;
};

type SilenceFormProps = {
  defaults: any;
  Info?: ComponentType;
  title: string;
  isNamespaced: boolean;
};

export const enum AlertSource {
  Platform = "platform",
  User = "user",
}
```

#### Hooks

| Type         | Convention                  | Example                                         |
| ------------ | --------------------------- | ----------------------------------------------- |
| Custom hooks | camelCase with `use` prefix | `useBoolean`, `usePerspective`, `useMonitoring` |
| Hook files   | camelCase with `use` prefix | `useBoolean.ts`, `usePerspective.tsx`           |

```typescript
// ✅ Good: Hook definition
export const useBoolean = (
  initialValue: boolean
): [boolean, () => void, () => void, () => void] => {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  return [value, toggle, setTrue, setFalse];
};
```

#### Constants

| Type                 | Convention           | Example                                            |
| -------------------- | -------------------- | -------------------------------------------------- |
| Constants            | SCREAMING_SNAKE_CASE | `PROMETHEUS_BASE_PATH`, `QUERY_CHUNK_SIZE`         |
| Resource definitions | PascalCase           | `AlertResource`, `RuleResource`, `SilenceResource` |

```typescript
// ✅ Good: Constants
export const QUERY_CHUNK_SIZE = 24 * 60 * 60 * 1000;
export const PROMETHEUS_BASE_PATH = window.SERVER_FLAGS.prometheusBaseURL;

export const AlertResource: MonitoringResource = {
  group: "monitoring.coreos.com",
  resource: "alertingrules",
  kind: "Alert",
  label: "Alert",
  url: "/monitoring/alerts",
  abbr: "AL",
};
```

#### Test IDs

Use the centralized `DataTestIDs` object in `web/src/components/data-test.ts`:

```typescript
// ✅ Good: Test ID definitions
export const DataTestIDs = {
  AlertCluster: "alert-cluster",
  AlertResourceIcon: "alert-resource-icon",
  CancelButton: "cancel-button",
  // Group related IDs using nested objects
  SilencesPageFormTestIDs: {
    AddLabel: "add-label",
    Comment: "comment",
    Creator: "creator",
  },
};
```

### React Component Patterns

#### Component Definition

Use functional components with explicit type annotations:

```typescript
// ✅ Good: Functional component with FC type and named export
import type { FC } from "react";

type ErrorAlertProps = {
  error: Error;
};

export const ErrorAlert: FC<ErrorAlertProps> = ({ error }) => {
  return (
    <Alert isInline title={error.name} variant="danger">
      {error.message}
    </Alert>
  );
};
```

#### Memoization

Use `memo` for components that receive stable props and render frequently:

```typescript
// ✅ Good: Memoized component with named export
import { memo } from "react";

export const Health: FC<{ health: "up" | "down" }> = memo(({ health }) => {
  return health === "up" ? (
    <GreenCheckCircleIcon />
  ) : (
    <RedExclamationCircleIcon />
  );
});
```

Use `useMemo` for expensive computations:

```typescript
// ✅ Good: Memoized computation
const additionalAlertSourceLabels = useMemo(
  () => getAdditionalSources(alerts, alertSource),
  [alerts]
);

// Avoid creating new arrays on every render
const queriesMemoKey = JSON.stringify(_.map(queries, "query"));
const queryStrings = useMemo(() => _.map(queries, "query"), [queriesMemoKey]);
```

Use `useCallback` for event handlers passed to child components:

```typescript
// ✅ Good: Memoized callbacks
const toggleIsEnabled = useCallback(
  () => dispatch(queryBrowserToggleIsEnabled(index)),
  [dispatch, index]
);

const doDelete = useCallback(() => {
  dispatch(queryBrowserDeleteQuery(index));
  focusedQuery = undefined;
}, [dispatch, index]);
```

#### Translations (i18n)

Always use the `useTranslation` hook for user-facing strings, this allows the translation
strings to be extracted and localized:

```typescript
// ✅ Good: Using translations with named export
import { useTranslation } from "react-i18next";

export const MyComponent: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <EmptyState>
      <Title>{t("No data available")}</Title>
      <EmptyStateBody>{t("Please try again later")}</EmptyStateBody>
    </EmptyState>
  );
};
```

### State Management

#### Context API

Use React Context for sharing state across component trees:

```typescript
// ✅ Good: Context definition
import React, { useMemo } from "react";

type MonitoringContextType = {
  plugin: MonitoringPlugins;
  prometheus: Prometheus;
  useAlertsTenancy: boolean;
  useMetricsTenancy: boolean;
  accessCheckLoading: boolean;
};

export const MonitoringContext = React.createContext<MonitoringContextType>({
  plugin: "monitoring-plugin",
  prometheus: "cmo",
  useAlertsTenancy: false,
  useMetricsTenancy: false,
  accessCheckLoading: true,
});

// Custom hook to consume context
export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  return context;
};
```

### TypeScript Best Practices

#### Type Imports

Use `type` imports for types that are only used for type checking:

```typescript
// ✅ Good: Type-only imports
import type { FC, ReactNode, ComponentType } from "react";
import { useState, useCallback, useEffect } from "react";
```

#### Avoid `any`

Use proper types instead of `any` when possible:

```typescript
// ❌ Bad
const handleData = (data: any) => { ... };

// ✅ Good
type DataResponse = {
  results: PrometheusResult[];
  status: string;
};
const handleData = (data: DataResponse) => { ... };
```

#### Utility Types

Leverage TypeScript utility types:

```typescript
// ✅ Good: Using utility types
type AugmentedColumnStyle = ColumnStyle & {
  className?: string;
};

type PartialMetric = Partial<Metric>;
type RequiredFields = Required<Pick<Config, "name" | "url">>;
```

---

## Testing Requirements

### Unit Tests

- **Frontend**: Co-locate test files with source files using `.spec.ts` suffix
- **Backend**: Use Go's testing package with `_test.go` suffix

```bash
# Run all tests
make test-backend
make test-frontend

# Run frontend tests with watch mode
cd web && npm run test:unit -- --watch
```

### E2E Tests (Cypress)

For significant UI changes, add or update Cypress tests:

- Test files: `web/cypress/e2e/`
- Documentation: `web/cypress/CYPRESS_TESTING_GUIDE.md`

```bash
# Run Cypress tests
cd web/cypress
npm run cypress:run --spec "cypress/e2e/**/regression/**"
```

---

## Internationalization (i18n)

All user-facing strings must be translatable:

1. Use the `t()` function from `useTranslation`
2. Add new keys to `web/locales/en/plugin__monitoring-plugin.json`
3. Run `make test-translations` to verify

```typescript
// ✅ Good
const { t } = useTranslation(process.env.I18N_NAMESPACE);
return <Title>{t("Alerting rules")}</Title>;

// ❌ Bad - hardcoded string
return <Title>Alerting rules</Title>;
```

---

## Troubleshooting

### Common Issues

#### Lint failures after commit

Run the linter and formatter before committing:

```bash
make lint-frontend
cd web && npm run prettier -- --write .
```

#### Tests failing locally but passing in CI

Make sure you're running the correct version of Node.js:

```bash
node --version  # Should be 22+
```

Clear npm cache and reinstall:

```bash
cd web
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Reinstalling frontend dependencies

If you encounter issues after switching branches or pulling main:

```bash
cd web
npm cache clean --force
rm -rf node_modules package-lock.json dist
npm install
npm run lint
npm run build
```

Confirm Node and npm versions are correct:

```bash
node --version   # Should be 22+
npm --version    # Matches Node release
which npm        # Ensure expected binary is used
```

#### Clearing cache when testing locally

When running local unit tests, clear caches first:

```bash
cd web
npm cache clean --force
rm -rf node_modules/.cache
npm run test:unit -- --clearCache
```

For Cypress E2E runs:

```bash
cd web/cypress
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
npm run cypress:run -- --config cacheAcrossSpecs=false
```

#### Translation key errors

Always use the `useTranslation` hook for user-facing strings:

```bash
make test-translations
```

Fix any errors by adding missing keys to `web/locales/en/plugin__monitoring-plugin.json`.

#### Build failures

Ensure all dependencies are installed:

```bash
make install
```

Check the Makefile targets available:

```bash
grep "^\.PHONY" Makefile | sed 's/.PHONY: //'
```

#### Port conflicts

If ports 9001 or 3000 are in use:

```bash
# Find and kill processes
lsof -ti:9001 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

---

## Getting Help

| Topic               | Resource                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| Plugin Architecture | [AGENTS.md](./AGENTS.md)                                                       |
| Development Setup   | [README.md](./README.md)                                                       |
| Cypress Testing     | [web/cypress/CYPRESS_TESTING_GUIDE.md](./web/cypress/CYPRESS_TESTING_GUIDE.md) |
| Console Plugin SDK  | [OpenShift Console SDK](https://github.com/openshift/console)                  |

For questions, reach out via:

- Slack: `#forum-cluster-observability-operator` (Red Hat internal)
- GitHub Issues: [openshift/monitoring-plugin](https://github.com/openshift/monitoring-plugin/issues)
