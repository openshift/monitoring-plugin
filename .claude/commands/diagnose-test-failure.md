---
name: diagnose-test-failure
description: Diagnose a Cypress test failure using error output, screenshots, and codebase analysis
parameters:
  - name: test-name
    description: "Full title of the failing test (from mochawesome 'fullTitle' or Cypress output)"
    required: true
  - name: spec-file
    description: "Path to the spec file (e.g., cypress/e2e/incidents/regression/01.reg_filtering.cy.ts)"
    required: true
  - name: error-message
    description: "The error message from the test failure"
    required: true
  - name: screenshot-path
    description: "Absolute path to the failure screenshot (will be read with multimodal vision)"
    required: false
  - name: stack-trace
    description: "The error stack trace (estack from mochawesome)"
    required: false
  - name: ci-context
    description: "Optional context from /analyze-ci-results (commit correlation, infra status)"
    required: false
---

# Diagnose Test Failure

Analyze a Cypress test failure to determine root cause and recommend a fix. This skill is used by the `/iterate-incident-tests` orchestrator but can also be invoked standalone.

## Diagnosis Protocol

**IMPORTANT**: Follow this order. Visual evidence first, then code analysis.

### Step 1: Read the Screenshot (if available)

If `screenshot-path` is provided, read it using the Read tool (multimodal).

Describe what you see:
- What page/view is displayed?
- Is the expected UI element visible? If not, what's in its place?
- Are there error dialogs, loading spinners, empty states, or overlays?
- Is the page fully loaded or still loading?
- Are there any browser console errors visible?
- Does the layout look correct (no overlapping elements, correct positioning)?

This visual context often reveals the root cause faster than reading code.

### Step 2: Read the Test Code

Read the spec file at `spec-file`. Find the failing test by matching `test-name`.

Identify:
- What the test is trying to do (user actions + assertions)
- Which page object methods it calls
- Which fixture it loads (look at `before`/`beforeEach` hooks)
- The specific assertion or command that failed
- Whether the failure is in a `before all` hook (affects all tests in suite) or a specific `it()` block

### Step 3: Read the Page Object

Read `web/cypress/views/incidents-page.ts`.

For each page object method used by the failing test:
- Check the selector — does it match current DOM conventions?
- Check for hardcoded waits vs proper Cypress chaining
- Look for methods that might be missing or outdated

### Step 4: Read the Fixture (if applicable)

If the test uses `cy.mockIncidentFixture('...')`, read the fixture YAML file.

Check:
- Does the fixture have the incidents/alerts the test expects?
- Are severities, states, components, timelines correct?
- Are there edge cases (empty arrays, missing fields, zero-duration timelines)?

### Step 5: Read the Mock Layer (if relevant)

If the error suggests an API/intercept issue, read relevant files in `cypress/support/incidents_prometheus_query_mocks/`:
- `prometheus-mocks.ts` — intercept setup and route matching
- `mock-generators.ts` — response data generation
- `types.ts` — type definitions for fixtures

Check:
- Does the intercept URL pattern match the actual API call?
- Is the response shape what the UI code expects?
- Are query parameters (group_id, alertname, severity) handled correctly?

### Step 6: Cross-reference with Error

Now combine visual evidence + code analysis + error message to determine root cause.

**Common patterns:**

| Error Pattern | Likely Cause |
|--------------|--------------|
| `Timed out retrying after Nms: Expected to find element: .selector` | Selector wrong, element not rendered, or page not loaded |
| `Expected N to equal M` (counts) | Fixture doesn't have enough data, or filter state is wrong |
| `expected true to be false` / vice versa | Assertion logic inverted |
| `Cannot read properties of undefined` | Page object method returns wrong element, or DOM structure changed |
| `cy.intercept() matched no requests` | Mock intercept URL doesn't match actual API call |
| `Timed out retrying` on `.should('be.visible')` | Element exists but hidden (z-index, opacity, overflow, display:none) |
| `before all hook` failure | Setup issue — fixture load, navigation, or login failed |
| `detached from the DOM` | Element re-rendered between find and action — needs `.should('exist')` guard |
| `e is not a function` / runtime JS error | Application code bug, not test issue |
| `x509: certificate` / `Unable to connect` | Infrastructure issue |

### Step 7: Classify and Recommend

Output your diagnosis in this exact format:

```
## Diagnosis

**Classification**: TEST_BUG | FIXTURE_ISSUE | PAGE_OBJECT_GAP | MOCK_ISSUE | REAL_REGRESSION | INFRA_ISSUE

**Confidence**: HIGH | MEDIUM | LOW

**Root Cause**:
[1-3 sentence explanation of what's wrong and why]

**Evidence**:
- Screenshot: [what the screenshot showed]
- Error: [what the error message tells us]
- Code: [what the code analysis revealed]

**Recommended Fix**:
- File: [path to file that needs editing]
- Change: [specific description of what to change]
- [If multiple files need changing, list each]

**Risk Assessment**:
- Will this fix affect other tests? [yes/no and why]
- Could this mask a real bug? [yes/no and why]

**Alternative Hypotheses**:
- [If confidence is MEDIUM or LOW, list other possible causes]
```

## Classification Reference

### Auto-fixable (proceed with Fix Agent)

| Classification | Description | Examples |
|---------------|-------------|----------|
| `TEST_BUG` | Test code is wrong | Wrong selector, incorrect assertion value, missing wait, wrong test order dependency |
| `FIXTURE_ISSUE` | Test data is wrong | Missing incident in fixture, wrong severity, timeline doesn't cover test's time window |
| `PAGE_OBJECT_GAP` | Page object needs update | Selector targets old class name, method missing for new UI element, method returns wrong element |
| `MOCK_ISSUE` | API mock is wrong | Intercept URL pattern outdated, response missing required field, query filter not handled |

### Not auto-fixable (report to user)

| Classification | Description | Examples |
|---------------|-------------|----------|
| `REAL_REGRESSION` | UI code has a bug | Component doesn't render, wrong data displayed, broken interaction |
| `INFRA_ISSUE` | Environment problem | Cluster down, cert expired, operator not installed, console unreachable |

### Distinguishing TEST_BUG from REAL_REGRESSION

This is the hardest classification. Use these heuristics:

1. **Was the test ever passing?** If it's a new test, lean toward `TEST_BUG`. If it was passing before, check what changed.
2. **Does the screenshot show the UI working correctly but the test expecting something different?** → `TEST_BUG`
3. **Does the screenshot show the UI broken (empty state, error, wrong data)?** → Likely `REAL_REGRESSION`
4. **Do other tests in the same suite pass?** If yes, the infra/app is fine → `TEST_BUG` or `FIXTURE_ISSUE`
5. **If CI context is available**: Check if the source code was modified in the PR. Modified source + broken test = likely `REAL_REGRESSION`

When in doubt, classify as `REAL_REGRESSION` — it's safer to report a false positive to the user than to silently "fix" a test that was correctly catching a bug.
