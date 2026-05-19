---
description: Refactor and clean up existing regression test for improved readability and maintainability
---

# Refactor Regression Test

Refactor an existing regression test to improve code quality, eliminate duplication, and enhance readability. This command should be run after initial test generation and manual verification.

## Purpose

After generating and verifying a regression test works correctly, this command:
- Extracts repetitive patterns into helper functions
- Improves test readability (makes `it()` blocks read like user stories)
- Consolidates similar assertions
- Suggests page object additions for reusable functionality
- Ensures compliance with e2e testing best practices

## Process

### 1. Analyze Existing Test

**Input**: Path to test file (e.g., `web/cypress/e2e/incidents/regression/05.reg_tooltip_positioning.cy.ts`)

**Read and analyze**:
- Test structure and flow
- Repetitive assertion patterns
- Complex multi-step verifications
- Inline calculations or data parsing
- Custom selectors that could be page object methods
- Overall readability of `it()` blocks

### 2. Identify Refactoring Opportunities

**Look for**:

#### Repeated Assertion Patterns
```typescript
// Example: Repeated opacity checks
incidentsPage.elements.alertsChartBarsPaths().eq(0).then(($bar) => {
  const opacity = parseFloat($bar.css('opacity') || '1');
  expect(opacity).to.equal(0.3);
});

incidentsPage.elements.alertsChartBarsPaths().eq(1).then(($bar) => {
  const opacity = parseFloat($bar.css('opacity') || '1');
  expect(opacity).to.equal(1.0);
});
```

#### Complex Multi-Step Verifications
```typescript
// Example: Complex tooltip verification repeated multiple times
incidentsPage.elements.incidentsChartBarsVisiblePaths().eq(0).trigger('mouseover');
cy.get('[role="tooltip"]').should('be.visible');
cy.get('[role="tooltip"]').should('contain.text', 'Expected text');
cy.get('[role="tooltip"]').then(($tooltip) => {
  const rect = $tooltip[0].getBoundingClientRect();
  expect(rect.top).to.be.greaterThan(0);
});
```

#### Inline Calculations
```typescript
// Example: Calculations within test body
incidentsPage.elements.component().invoke('text').then((text) => {
  const cleaned = text.trim().toLowerCase();
  const parts = cleaned.split(',');
  expect(parts).to.have.length(3);
});
```

#### Custom Selectors Used Multiple Times
```typescript
// Example: Direct selector usage instead of page object
cy.get('[role="tooltip"]').should('be.visible');
cy.get('[role="tooltip"]').should('contain.text', 'Text');
// Repeated many times in the test
```

### 3. Create Helper Functions

**Guidelines**:
- Place helper functions within the test file (inside or outside `describe()` block)
- Use descriptive names that explain what they verify
- Keep helpers focused on a single responsibility
- Preserve type safety with TypeScript types

**Helper Function Patterns**:

#### Simple Assertion Helper
```typescript
const verifyElementProperty = (
  selector: Cypress.Chainable<JQuery<HTMLElement>>,
  property: string,
  expectedValue: any
) => {
  selector.then(($el) => {
    const value = $el.css(property);
    expect(parseFloat(value || '0')).to.equal(expectedValue);
  });
};
```

#### Multi-Step Verification Helper
```typescript
const verifyTooltipContent = (expectedTexts: string[], shouldBeSilenced: boolean = false) => {
  const tooltip = cy.get('[role="tooltip"]').should('be.visible');
  expectedTexts.forEach(text => tooltip.should('contain.text', text));
  tooltip.should(shouldBeSilenced ? 'contain.text' : 'not.contain.text', '(silenced)');
};
```

#### Interaction + Verification Helper
```typescript
const hoverAndVerifyTooltipPosition = (barIndex: number, expectedPosition: 'top' | 'bottom') => {
  incidentsPage.elements.incidentsChartBarsVisiblePaths()
    .eq(barIndex)
    .trigger('mouseover', { force: true });
  
  cy.get('[role="tooltip"]').should('be.visible').then(($tooltip) => {
    const rect = $tooltip[0].getBoundingClientRect();
    if (expectedPosition === 'top') {
      expect(rect.bottom).to.be.lessThan(Cypress.$(window).height());
    } else {
      expect(rect.top).to.be.greaterThan(0);
    }
  });
};
```

#### Data Processing Helper
```typescript
const parseComponentList = (text: string): string[] => {
  return text.trim().split(',').map(s => s.trim()).filter(s => s.length > 0);
};
```

### 4. Refactor Test Body

**Goal**: The `it()` block should read like a user story, with implementation details hidden in helpers.

**Before**:
```typescript
it('1. Verify alert opacity and tooltips', () => {
  cy.log('1.1 Check first alert opacity');
  incidentsPage.elements.alertsChartBarsPaths().eq(0).then(($bar) => {
    const opacity = parseFloat($bar.css('opacity') || '1');
    expect(opacity).to.equal(0.3);
  });
  
  cy.log('1.2 Check first alert tooltip');
  incidentsPage.elements.alertsChartBarsPaths().eq(0).trigger('mouseover');
  cy.get('[role="tooltip"]').should('be.visible');
  cy.get('[role="tooltip"]').should('contain.text', 'Alert 1');
  cy.get('[role="tooltip"]').should('contain.text', '(silenced)');
  
  cy.log('1.3 Check second alert opacity');
  incidentsPage.elements.alertsChartBarsPaths().eq(1).then(($bar) => {
    const opacity = parseFloat($bar.css('opacity') || '1');
    expect(opacity).to.equal(1.0);
  });
  
  cy.log('1.4 Check second alert tooltip');
  incidentsPage.elements.alertsChartBarsPaths().eq(1).trigger('mouseover');
  cy.get('[role="tooltip"]').should('be.visible');
  cy.get('[role="tooltip"]').should('contain.text', 'Alert 2');
  cy.get('[role="tooltip"]').should('not.contain.text', '(silenced)');
});
```

**After**:
```typescript
const verifyAlertOpacity = (alertIndex: number, expectedOpacity: number) => {
  incidentsPage.elements.alertsChartBarsPaths()
    .eq(alertIndex)
    .then(($bar) => {
      const opacity = parseFloat($bar.css('opacity') || '1');
      expect(opacity).to.equal(expectedOpacity);
    });
};

const verifyAlertTooltip = (alertIndex: number, expectedTexts: string[], shouldBeSilenced: boolean) => {
  incidentsPage.elements.alertsChartBarsPaths().eq(alertIndex).trigger('mouseover');
  const tooltip = cy.get('[role="tooltip"]').should('be.visible');
  expectedTexts.forEach(text => tooltip.should('contain.text', text));
  tooltip.should(shouldBeSilenced ? 'contain.text' : 'not.contain.text', '(silenced)');
};

it('1. Verify alert opacity and tooltips', () => {
  cy.log('1.1 Verify silenced alert has reduced opacity and indicator');
  verifyAlertOpacity(0, 0.3);
  verifyAlertTooltip(0, ['Alert 1'], true);
  
  cy.log('1.2 Verify non-silenced alert has full opacity without indicator');
  verifyAlertOpacity(1, 1.0);
  verifyAlertTooltip(1, ['Alert 2'], false);
  
  cy.log('Verified: Alert silence indicators work correctly');
});
```

### 5. Suggest Page Object Additions

**When to suggest page object additions**:
- Helper functionality could be reused across multiple test files
- Custom selectors are used repeatedly (e.g., `cy.get('[role="tooltip"]')`)
- Complex interactions that represent common user actions

**Format suggestion**:
```
The following functionality could be added to incidents-page.ts for reusability:

Elements:
- tooltip: () => cy.get('[role="tooltip"]')
- tooltipContent: () => cy.get('[role="tooltip"] .pf-c-tooltip__content')

Methods:
- hoverOverIncidentBar: (index: number) => {
    cy.log('incidentsPage.hoverOverIncidentBar');
    incidentsPage.elements.incidentsChartBarsVisiblePaths()
      .eq(index)
      .trigger('mouseover', { force: true });
  }

- verifyTooltipVisible: () => {
    cy.log('incidentsPage.verifyTooltipVisible');
    incidentsPage.elements.tooltip().should('be.visible');
  }

Should I add these to incidents-page.ts?
```

### 6. Remove cy.pause() Statements

**Important**: Only remove `cy.pause()` statements if user explicitly requests it or confirms.

**When to remove**:
- User says "remove pauses"
- User says "cleanup test" or "finalize test"
- Test has been verified and is working correctly

**When NOT to remove**:
- User just generated the test (they need to verify first)
- User hasn't confirmed the test works
- Not explicitly requested

**Process**:
1. Identify all `cy.pause()` statements
2. Check if they're still needed for manual verification
3. If removing, preserve the surrounding assertions
4. Update `cy.log()` messages to reflect completed verification

**Example removal**:
```typescript
// Before
cy.log('1.1 Verify incidents loaded');
incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);
cy.pause(); // Manual verification point

// After
cy.log('1.1 Verify incidents loaded');
incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);
```

### 7. Ensure E2E Best Practices

**Verify the refactored test follows**:
- [ ] Tests cover complete user flows, not isolated actions
- [ ] Each `it()` block represents a realistic user journey
- [ ] Test body is readable as a story (implementation details in helpers)
- [ ] Appropriate test count (1-3 comprehensive tests preferred)
- [ ] Tests are independent and self-contained
- [ ] Helper functions have descriptive names
- [ ] No duplicate code patterns
- [ ] Follows workspace rules (no emojis, sparse comments)

### 8. Output Refactored Test

**Provide**:
1. **Complete refactored test file**: Full content with helpers and cleaned-up test body
2. **Summary of changes**:
   - List of helper functions added
   - Number of duplications eliminated
   - Readability improvements
   - Lines of code change (before/after)
3. **Page object suggestions**: If any (with implementation)
4. **Validation status**: Confirm best practices checklist

## Example Transformations

### Example 1: Tooltip Verification

**Before** (repetitive):
```typescript
it('1. Verify tooltips', () => {
  cy.log('1.1 Bottom bar tooltip');
  incidentsPage.elements.incidentsChartBarsVisiblePaths()
    .first()
    .trigger('mouseover', { force: true });
  cy.get('[role="tooltip"]').should('be.visible');
  cy.get('[role="tooltip"]').then(($tooltip) => {
    const rect = $tooltip[0].getBoundingClientRect();
    expect(rect.top).to.be.greaterThan(0);
  });
  
  cy.log('1.2 Top bar tooltip');
  incidentsPage.elements.incidentsChartBarsVisiblePaths()
    .last()
    .trigger('mouseover', { force: true });
  cy.get('[role="tooltip"]').should('be.visible');
  cy.get('[role="tooltip"]').then(($tooltip) => {
    const rect = $tooltip[0].getBoundingClientRect();
    const viewportHeight = Cypress.$(window).height();
    expect(rect.bottom).to.be.lessThan(viewportHeight);
  });
});
```

**After** (clean):
```typescript
const verifyTooltipPosition = (barIndex: number, position: 'top' | 'bottom') => {
  incidentsPage.elements.incidentsChartBarsVisiblePaths()
    .eq(barIndex)
    .trigger('mouseover', { force: true });
  
  cy.get('[role="tooltip"]').should('be.visible').then(($tooltip) => {
    const rect = $tooltip[0].getBoundingClientRect();
    if (position === 'bottom') {
      expect(rect.top).to.be.greaterThan(0);
    } else {
      const viewportHeight = Cypress.$(window).height();
      expect(rect.bottom).to.be.lessThan(viewportHeight);
    }
  });
};

it('1. Verify tooltips', () => {
  cy.log('1.1 Verify bottom and top bar tooltip positioning');
  verifyTooltipPosition(0, 'bottom');
  verifyTooltipPosition(-1, 'top');
  cy.log('Verified: Tooltips positioned correctly at all chart positions');
});
```

### Example 2: Opacity and Tooltip Combined

**Before** (verbose):
```typescript
it('1. Alert silence indicators', () => {
  cy.log('1.1 Check silenced alert');
  incidentsPage.elements.alertsChartBarsPaths().eq(0).then(($bar) => {
    const opacity = parseFloat($bar.css('opacity') || '1');
    expect(opacity).to.equal(0.3);
  });
  incidentsPage.elements.alertsChartBarsPaths().eq(0).trigger('mouseover');
  cy.get('[role="tooltip"]').should('be.visible');
  cy.get('[role="tooltip"]').should('contain.text', '(silenced)');
  
  cy.log('1.2 Check non-silenced alert');
  incidentsPage.elements.alertsChartBarsPaths().eq(1).then(($bar) => {
    const opacity = parseFloat($bar.css('opacity') || '1');
    expect(opacity).to.equal(1.0);
  });
  incidentsPage.elements.alertsChartBarsPaths().eq(1).trigger('mouseover');
  cy.get('[role="tooltip"]').should('be.visible');
  cy.get('[role="tooltip"]').should('not.contain.text', '(silenced)');
});
```

**After** (concise):
```typescript
const verifyAlertSilenceIndicator = (
  alertIndex: number,
  isSilenced: boolean,
  alertName: string
) => {
  const expectedOpacity = isSilenced ? 0.3 : 1.0;
  
  incidentsPage.elements.alertsChartBarsPaths()
    .eq(alertIndex)
    .then(($bar) => {
      const opacity = parseFloat($bar.css('opacity') || '1');
      expect(opacity).to.equal(expectedOpacity);
    });
  
  incidentsPage.elements.alertsChartBarsPaths()
    .eq(alertIndex)
    .trigger('mouseover');
  
  const tooltip = cy.get('[role="tooltip"]').should('be.visible');
  tooltip.should('contain.text', alertName);
  tooltip.should(isSilenced ? 'contain.text' : 'not.contain.text', '(silenced)');
};

it('1. Alert silence indicators', () => {
  cy.log('1.1 Verify silence indicators on silenced and non-silenced alerts');
  verifyAlertSilenceIndicator(0, true, 'SilencedAlert');
  verifyAlertSilenceIndicator(1, false, 'ActiveAlert');
  cy.log('Verified: Silence indicators work correctly');
});
```

## Validation Checklist

Before outputting refactored test:
- [ ] Helper functions eliminate all significant code duplication
- [ ] Helper functions have descriptive, clear names
- [ ] Test body (`it()` blocks) reads like a user story
- [ ] Complex logic is extracted to helpers
- [ ] Tests still follow e2e philosophy (complete flows)
- [ ] Tests remain independent and self-contained
- [ ] No obvious comments (sparse comments rule)
- [ ] No emojis in logs
- [ ] `cy.pause()` removed only if explicitly requested
- [ ] Page object suggestions identified (if applicable)
- [ ] Code is more maintainable than before

## Notes

- **Focus on readability**: The primary goal is making tests easier to understand and maintain
- **Preserve test behavior**: Refactoring should not change what the test verifies
- **Don't over-abstract**: Only extract patterns that appear 2+ times
- **Keep helpers simple**: Each helper should have a single, clear purpose
- **Test-specific vs. reusable**: Keep test-specific helpers in test file, suggest page object additions for reusable functionality
- **Respect user's verification process**: Don't remove `cy.pause()` unless explicitly asked

