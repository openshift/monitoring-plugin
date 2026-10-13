---
description: Generate automated regression test from test documentation
---

# Generate Regression Test

Generate automated regression tests from test documentation in [`docs/incident_detection/tests/`](../../docs/incident_detection/tests/), following the style of existing tests in `@incidents/` and using `@incidents-page.ts` Page Object Model.


## Process

### 1. Parse Test Documentation

**Input**: Section number (e.g., "Section 2.1", "1.2", "3")

**Actions**:
- Read test flow files from [`docs/incident_detection/tests/`](../../docs/incident_detection/tests/) (e.g., `1.filtering_flows.md`, `2.ui_display_flows.md`)
- Locate the specified section by number
- Extract:
  - Section title and description
  - Test prerequisites and data requirements
  - Test cases with expected behaviors
  - Known bug references (e.g., "Verifies: OU-XXX")
  - Any notes about testability (e.g., "WARNING Not possible to test on Injected Data")

### 2. Analyze Test Requirements

**Extract from documentation**:
- **Test data needs**: What incidents, alerts, severities are required
- **Test actions**: User interactions (clicks, hovers, filters, selections)
- **Assertions**: Expected outcomes (visibility, counts, content, positions)
- **Edge cases**: Special scenarios to verify

**Design test flows following Cypress e2e best practices**:
- **Think user journeys**: How would a real user interact with this feature?
- **Combine related actions**: Don't split filtering, verification, and interaction into separate tests
- **Prefer comprehensive flows**: Each `it()` should test a complete, realistic workflow
- **Avoid unit test mindset**: Don't create many tiny isolated tests

**Map to existing patterns**:
- Identify which `incidentsPage` elements/methods are needed
- Identify any missing page object functionality
- Determine fixture requirements

### 3. Check/Create Fixtures

**Fixture location**: `web/cypress/fixtures/incident-scenarios/`

**Naming convention**: `XX-descriptive-name.yaml` (e.g., `13-tooltip-positioning-scenarios.yaml`)

**Process**:
1. Check if appropriate fixture exists for the test requirements
2. If missing, prompt user:
   ```
   Fixture not found for this test scenario.
   
   Required test data:
   - [List incidents, alerts, severities needed]
   
   Should I create a fixture using the generate-incident-fixture command?
   ```
3. If user approves, delegate to `generate-incident-fixture` command
4. **Preference**: Use single scenario per test file for focused regression testing
5. Validate created fixture against schema

**Reference**: See `.cursor/commands/generate-incident-fixture.md` for fixture creation

### 4. Generate Test File

**File location**: `web/cypress/e2e/incidents/regression/`

**Naming convention**: `XX.reg_<section-name>.cy.ts`
- Use next available number (check existing files)
- Convert section title to kebab-case
- Examples: `05.reg_tooltip_positioning.cy.ts`, `06.reg_silence_matching.cy.ts`

**File structure**:
```typescript
/*
[Brief description of what this test verifies]

[Additional context about the bug or behavior being tested]

Verifies: OU-XXX
*/

import { incidentsPage } from '../../../views/incidents-page';

const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: [Section Name]', () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    cy.log('[Brief description of scenario being loaded]');
    cy.mockIncidentFixture('incident-scenarios/XX-scenario-name.yaml');
  });

  it('1. [First test case description]', () => {
    cy.log('1.1 [First step description]');
    incidentsPage.clearAllFilters();
    
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', N);
    cy.pause(); // Manual verification point
    
    cy.log('1.2 [Second step description]');
    // More test steps with assertions
    cy.pause(); // Manual verification point

    // Another test case...
  });
});
```

### 5. Implement Automated Assertions

Convert manual verification steps from documentation to automated assertions.

**IMPORTANT - E2E Test Flow Design**:
- **Combine related steps**: Group filtering, verification, interaction, and results checking in one test
- **Test complete workflows**: Each `it()` should tell a complete story of user interaction
- **Multiple assertions per test**: Don't split every assertion into a separate test
- **Realistic user journeys**: Simulate how users actually use the feature, with multiple steps
- Tests can be 50-100+ lines if they represent a complete, realistic user workflow

**IMPORTANT - Two-Phase Approach**:
- **Initial test generation**: Include `cy.pause()` statements after key setup steps for manual verification
- **Purpose**: Allow user to manually verify behavior before adding complex assertions
- **User workflow**: User will manually delete `cy.pause()` statements once verified
- **Follow-up edits**: Do NOT reintroduce `cy.pause()` if user has already removed them

**When to include cy.pause()**:
- Include in newly generated test files
- Include when adding new test cases to existing files
- Do NOT include if editing existing test cases that already have assertions

**Common assertion patterns**:

#### Visibility and Existence
```typescript
incidentsPage.elements.incidentsChartContainer().should('be.visible');
incidentsPage.elements.incidentsTable().should('not.exist');
```

#### Counts and Length
```typescript
incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);
incidentsPage.elements.incidentsDetailsTableRows().should('have.length.greaterThan', 0);
```

#### Text Content
```typescript
incidentsPage.elements.daysSelectToggle().should('contain.text', '7 days');
incidentsPage.elements.incidentsTableComponentCell(0)
  .invoke('text')
  .should('contain', 'monitoring');
```

#### Conditional Waiting
```typescript
cy.waitUntil(
  () => incidentsPage.elements.incidentsChartBarsGroups().then($groups => $groups.length === 12),
  {
    timeout: 10000,
    interval: 500,
    errorMsg: 'All 12 incidents should load within 10 seconds'
  }
);
```

#### Position and Layout Checks
```typescript
incidentsPage.elements.incidentsChartBarsVisiblePaths()
  .first()
  .then(($element) => {
    const rect = $element[0].getBoundingClientRect();
    expect(rect.width).to.be.greaterThan(5);
    expect(rect.height).to.be.greaterThan(0);
  });
```

#### Tooltip Interactions
```typescript
incidentsPage.elements.incidentsChartBarsVisiblePaths()
  .first()
  .trigger('mouseover', { force: true });

cy.get('[role="tooltip"]').should('be.visible');
cy.get('[role="tooltip"]').should('contain.text', 'Expected content');
```

#### Filter Chips
```typescript
incidentsPage.elements.severityFilterChip().should('be.visible');
incidentsPage.elements.severityFilterChip()
  .should('contain.text', 'Critical');
```

### 6. Page Object Usage

**Priority order**:
1. Use existing `incidentsPage.elements.*` selectors
2. Use existing `incidentsPage.*` methods
3. Suggest adding new elements/methods to page object
4. Custom selectors only as last resort

**When missing functionality is identified**:

Prompt user:
```
The following elements/methods are needed but not present in incidents-page.ts:

Elements needed:
- tooltipContainer: () => cy.get('[role="tooltip"]')
- tooltipContent: () => cy.get('[role="tooltip"] .pf-c-tooltip__content')

Methods needed:
- hoverOverIncidentBar: (index: number) => {
    cy.log('incidentsPage.hoverOverIncidentBar');
    incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .eq(index)
      .trigger('mouseover', { force: true });
  }

Should I add these to incidents-page.ts?
```

**Page Object Patterns**:

*Element selector*:
```typescript
elements: {
  simpleElement: () => cy.byTestID(DataTestIDs.Component.Element),
  
  parameterizedElement: (param: string) => 
    cy.byTestID(`${DataTestIDs.Component.Element}-${param.toLowerCase()}`),
  
  compositeSelector: () => 
    incidentsPage.elements.toolbar().contains('span', 'Category').parent(),
}
```

*Action method*:
```typescript
actionName: (param: Type) => {
  cy.log('incidentsPage.actionName');
  incidentsPage.elements.something().click();
  incidentsPage.elements.result().should('be.visible');
}
```

*Query method returning Chainable*:
```typescript
getData: (): Cypress.Chainable<DataType> => {
  cy.log('incidentsPage.getData');
  return incidentsPage.elements.container()
    .invoke('text')
    .then((text) => {
      return cy.wrap(processData(text));
    });
}
```

#### 6.5. Type Safety Guidelines

**Use specific types, avoid `any`**:

```typescript
// Good
const verifyOpacity = (
  selector: Cypress.Chainable<JQuery<HTMLElement>>,
  expectedOpacity: number
) => { ... }

// Avoid
const verifyProperty = (selector: any, value: any) => { ... }
```

**Common Cypress patterns**:
- DOM elements: `Cypress.Chainable<JQuery<HTMLElement>>`
- Data returns: `Cypress.Chainable<string | number | boolean>`
- Actions: `Cypress.Chainable<void>` or omit return type
- Constrained strings: `'critical' | 'warning' | 'info'`

**Always specify return types** when suggesting page object methods.

### 7. Error & Ambiguity Handling

Handle common failure scenarios gracefully and make reasonable decisions when requirements are unclear.

#### 7.1. Ambiguous Test Documentation

**When**: Test documentation is unclear, incomplete, or contradictory.

**Actions**:
1. Check similar test sections and existing regression tests for patterns
2. Make reasonable assumptions based on common UI testing patterns
3. Document assumptions in test comments with TODO markers
4. Prompt user:
   ```
   Found ambiguities: [list specific unclear points]
   Proceeding with assumptions: [list assumptions]
   Test will include TODO comments for review. Continue?
   ```

**Example**:
```typescript
// TODO: Documentation unclear on severity filter - assuming 'Critical' based on similar tests
incidentsPage.toggleFilter('Critical');
```

#### 7.3. Fixture Not Found or Multiple Fixtures Match

**Scenario A - No fixture exists**:
1. Search for similar fixtures in `web/cypress/fixtures/incident-scenarios/`
2. Prompt with options:
   ```
   No fixture found. Required: [list requirements]
   
   Options:
   1. Create new fixture (recommended)
   2. Modify existing: [list closest matches]
   3. Use cy.mockIncidents([]) for empty state
   ```

**Scenario B - Multiple fixtures match**:
1. Rank by specificity (incident count, severities, components match)
2. Prompt with comparison:
   ```
   Multiple fixtures match:
   1. 05-severity-filtering.yaml (90% match) ← Recommended
      ✓ Required severities, ✓ Components, ✓ Count
   2. 07-comprehensive.yaml (75% match)
      ✓ Severities, ~ Components, ⚠ More incidents than needed
   ```

#### 7.6. Conflicting Guidance Between Documentation and Existing Tests

**When**: Documentation describes behavior differently than existing tests implement.

**Actions**:
```
Conflict detected:

Documentation (Section X): [description]
Existing test (file.cy.ts): [different implementation]

Which to follow?
1. Documentation (may indicate bug in existing test)
2. Existing test (documentation may be outdated)
3. Investigate further
```

#### 7.7. Page Object File Not Found or Outdated

**When**: `incidents-page.ts` not found or structure differs significantly.

**Actions**:
1. Search likely locations: `web/cypress/views/`, `web/cypress/support/page-objects/`
2. If different structure, attempt to adapt
3. If not found:
   ```
   incidents-page.ts not found.
   
   Options:
   1. Provide correct path
   2. Use custom selectors (not recommended)
   3. Cannot proceed without page object
   ```

#### 7.8. Missing DataTestIDs in Page Object

**When**: Element needs DataTestID that doesn't exist in page object.

**Actions**:
```
DataTestID not found: [name]

Fallback options:
1. Text-based: cy.contains('[data-test-id*="chip"]', 'Critical')
2. Role-based: cy.get('[role="listitem"]').contains('Critical')
3. Add DataTestID to component (recommended) ← Recommended

Which approach?
```

#### 7.9. Test Requirements Exceed Fixture Capabilities

**When**: Test needs scenarios impossible with fixtures (exact timing, external services, animations).

**Actions**:
```
Requirement may not be fully testable with fixtures:
"[exact requirement]"

Issue: [explain limitation]

Approaches:
1. Test relative behavior (testable with fixtures) ← Recommended
2. Use cy.clock() for timing control (if applicable)
3. Mark as integration test requiring real backend
4. Document: "WARNING: Not possible to test on injected data"
```

#### 7.10. General Fallback Strategy

**For any unexpected situation**:

1. **Don't fail silently** - Always inform user
2. **Provide context** - Explain what went wrong and impact
3. **Offer 2-3 options** with recommendation
4. **Document workarounds** in comments

**Template**:
```
[Issue] - [Why it matters]

Options:
1. [Recommended approach] ← Recommended
2. [Alternative]
3. [Fallback]

Proceeding with option 1 will: [actions]
Continue? (y/n/specify)
```

### 8. Refactoring
**Note on Refactoring**: Initial test generation focuses on functionality and coverage. After manual verification, use the `/refactor-regression-test` command to clean up duplications and improve readability by extracting helper functions.


### 9. Validation Before Output

**Automated checks (AI should verify):**
- [ ] File naming matches `XX.reg_<section-name>.cy.ts`
- [ ] Standard MCP/MP configuration blocks present
- [ ] Uses `cy.beforeBlockCOO(MCP, MP)` in `before()` hook
- [ ] Uses `incidentsPage.goTo()` in `beforeEach()`
- [ ] Uses `cy.mockIncidentFixture()` with valid fixture path
- [ ] No emojis in cy.log() statements
- [ ] File header includes purpose and issue reference
- [ ] **For new tests**: Includes `cy.pause()` after key verification points

**Human judgment (AI provides evidence):**
- [ ] **Tests follow e2e philosophy**: Each `it()` covers a complete user flow
      Evidence: List test structure, count of `it()` blocks, steps per test
- [ ] **Test reads like a story**: Implementation details hidden in helpers
      Evidence: Show helper functions extracted, test body readability

**For complete detailed checklist**, see `incidents-testing-guidelines.mdc`
## Example Usage

### Example 1: Generate Tooltip Positioning Test

**User Input**: "Generate regression test for Section 2.1: Tooltip Positioning"

**AI Actions**:
1. Parse Section 2.1 from testing_flows_ui.md
2. Identify requirements:
   - Test tooltip positioning for incidents at different chart positions
   - Verify tooltip content for multi-component incidents
   - Test tooltip positioning in alerts chart
3. **Design comprehensive flow**: Combine all tooltip testing into realistic user journeys
   - Flow 1: User hovers over multiple bars to inspect incidents (bottom, middle, top positions)
   - Flow 2: User explores multi-component incident details via tooltip
4. Check for fixture - not found
5. Prompt: "Fixture needed with 14 incidents at varying Y positions. Create?"
6. Generate `05.reg_tooltip_positioning.cy.ts` with **comprehensive multi-step tests**:

```typescript
/*
Regression test for Charts UI tooltip positioning (Section 2.1)

Verifies that tooltips appear correctly positioned without overlapping
bars or going off-screen, regardless of bar position in chart.
Tests both incidents chart and alerts chart tooltip behavior.

Verifies: OU-XXX
*/

import { incidentsPage } from '../../../views/incidents-page';

const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Tooltip Positioning', () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    cy.log('Loading tooltip positioning test scenarios');
    cy.mockIncidentFixture('incident-scenarios/13-tooltip-positioning-scenarios.yaml');
  });

  it('1. Complete tooltip interaction flow - positioning, content, and navigation', () => {
    cy.log('1.1 Verify all incidents loaded');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('7 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 14);
    cy.pause(); // Verify incidents loaded correctly
    
    cy.log('1.2 Test bottom bar tooltip positioning');
    incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .first()
      .trigger('mouseover', { force: true });
    
    cy.get('[role="tooltip"]').should('be.visible');
    cy.get('[role="tooltip"]').then(($tooltip) => {
      const tooltipRect = $tooltip[0].getBoundingClientRect();
      expect(tooltipRect.top).to.be.greaterThan(0);
      expect(tooltipRect.left).to.be.greaterThan(0);
    });
    cy.pause(); // Verify bottom tooltip positioning
    
    cy.log('1.3 Test middle bar tooltip and verify content');
    incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .eq(7)
      .trigger('mouseover', { force: true });
    
    cy.get('[role="tooltip"]').should('be.visible');
    cy.get('[role="tooltip"]').should('contain.text', 'Incident');
    cy.pause(); // Verify middle tooltip
    
    cy.log('1.4 Test top bar tooltip positioning');
    incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .last()
      .trigger('mouseover', { force: true });
    
    cy.get('[role="tooltip"]').should('be.visible');
    cy.get('[role="tooltip"]').then(($tooltip) => {
      const tooltipRect = $tooltip[0].getBoundingClientRect();
      const viewportHeight = Cypress.$(window).height();
      expect(tooltipRect.bottom).to.be.lessThan(viewportHeight);
    });
    cy.pause(); // Verify top tooltip positioning
    
    cy.log('1.5 Hover over multi-component incident and verify content');
    incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .eq(3)
      .trigger('mouseover', { force: true });
    
    cy.get('[role="tooltip"]')
      .should('be.visible')
      .should('contain.text', 'network')
      .should('contain.text', 'compute')
      .should('contain.text', 'storage');
    cy.pause(); // Verify multi-component tooltip content
    
    cy.log('1.6 Click incident bar and verify details panel opens');
    incidentsPage.elements.incidentsChartBarsVisiblePaths().eq(3).click();
    incidentsPage.elements.incidentsDetailsPanel().should('be.visible');
    incidentsPage.elements.incidentsDetailsTableRows()
      .should('have.length.greaterThan', 0);
    cy.pause(); // Verify details panel
    
    cy.log('Verified: Complete tooltip interaction and navigation workflow');
  });
});
```

6. Suggest page object additions if needed (e.g., tooltip helpers)

### Example 2: Generate Filtering Test

**User Input**: "Generate regression test for Section 1: Filtering Bugs"

**AI Actions**:
1. Parse Section 1 from testing_flows_ui.md
2. Note: Fixture `7-comprehensive-filtering-test-scenarios.yaml` already exists
3. **Design comprehensive flow**: Instead of separate tests for each filter type, create complete filtering workflows
   - Flow 1: User applies multiple filters in sequence, verifies each step, then clears all
   - Flow 2: User changes time range while filters are active, verifies data updates
4. Generate `01.reg_filtering.cy.ts` with **comprehensive multi-step tests**
5. Each test should have 5-8 steps covering realistic filter combinations and transitions

## Output Format

Provide:
1. **Test file path and name**: Full path to generated test file
2. **Test file content**: Complete TypeScript test file
3. **Fixture status**: 
   - If existing: "Using fixture: incident-scenarios/X-name.yaml"
   - If new: "Created fixture: incident-scenarios/X-name.yaml" + YAML content
4. **Page object changes**: If any elements/methods need to be added, list them with implementation
5. **Validation status**: Confirm all checklist items passed

## Notes

- **Follow Cypress e2e/integration testing philosophy**: Tests should cover complete user flows, not isolated units
- **Prefer comprehensive flows**: Generate 1-3 longer tests per file rather than 10+ tiny tests
- **Think user journeys**: Combine related actions (filtering → verification → interaction → results) in single tests
- Tests can be 50-100+ lines if they represent realistic, complete workflows
- Tests should be runnable immediately without manual intervention
- Each test should be independent and self-contained (not dependent on execution order)
- Follow workspace rules: no emojis in logs, sparse comments
- Prefer single scenario per test file for focused regression testing
- Reference the bug tracking number (e.g., "Verifies: OU-XXX") if available in documentation
- If documentation mentions "WARNING Not possible to test", note this in test comments and implement as far as possible
- Use `cy.waitUntil()` for dynamic loading scenarios instead of fixed waits when possible

## Workflow

**Recommended workflow**:
1. Use this command to generate initial test from documentation
2. Manually verify the test works (using `cy.pause()` points)
3. Once verified, use `/refactor-regression-test` to clean up and improve code quality


