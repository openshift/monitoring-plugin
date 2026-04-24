---
description: Review and clean up raw selectors, duplicated patterns, and inline constants in Cypress page objects — focuses on incidents-page.ts but applicable to any page object
parameters:
  - name: file
    description: "Page object file to refactor (default: web/cypress/views/incidents-page.ts)"
    required: false
    type: string
---

# Refactor Page Object Selectors

Review a Cypress page object for raw selectors, duplicated patterns, and inline
constants. Apply a consistent encapsulation strategy without changing behavior.

## Target File

`$1` (default: `web/cypress/views/incidents-page.ts`)

## Step 1: Inventory Raw Selectors

Search the file for selectors that bypass the `elements` encapsulation layer:

```
Pattern                          | Example
---------------------------------|--------------------------------------------
cy.get('...')                    | cy.get('[data-test="..."]')
cy.get('.pf-...')                | cy.get('.pf-v6-c-tabs__item')
Cypress.$('...')                 | Cypress.$('.pf-v6-c-tabs__item:contains(...)')
.find('tag[attr]')               | .find('path[role="presentation"]')
$body.find('...')                | $body.find('g[role="presentation"]...')
```

For each raw selector found, classify it:

| Classification | Action |
|---------------|--------|
| **Has a `data-test` attribute** | Should use `cy.byTestID()` or an existing `elements.*` method |
| **PatternFly class selector** | Extract to a module-level constant with a descriptive name |
| **SVG/DOM structural selector** | Extract to a module-level constant if used more than once |
| **Duplicated across methods** | Extract to a shared constant or helper method |
| **Used only once, self-explanatory** | Leave inline — extraction would just add indirection |

## Step 2: Identify Duplicated Patterns

Look for repeated code blocks that do the same thing in multiple methods:

- **Filter predicates**: e.g., fill-opacity > 0 check used in multiple places
- **Navigation sequences**: e.g., navigate to Alerting → wait for tab → switch
- **Polling patterns**: e.g., `cy.waitUntil(() => Cypress.$(...).length > 0, ...)`

For each duplicated pattern:
- If used 2+ times: extract to a shared helper (method or module-level function)
- If the pattern includes a selector: extract the selector to a constant AND
  the pattern to a helper

## Step 3: Apply Fixes

Rules for extraction:

### Constants (module-level, above the export)

Use for selectors that:
- Are used in 2+ places
- Contain framework-specific class names (PatternFly, Console)
- Would be hard to grep for if they needed updating

Naming: `_UPPER_SNAKE_CASE` with a descriptive name.

```typescript
// jQuery selector for the Incidents tab — covers PF6 and legacy nav markup.
const _INCIDENTS_TAB_SELECTOR =
  '.pf-v6-c-tabs__item:contains("Incidents"), ' +
  '.co-m-horizontal-nav__menu-item:contains("Incidents")';
```

### Filter predicates (module-level functions)

Use for `.filter()` callbacks used in 2+ places.

```typescript
const _isVisiblePath = (_: number, el: HTMLElement) => {
  const opacity =
    Cypress.$(el).css('fill-opacity') || Cypress.$(el).attr('fill-opacity');
  return parseFloat(opacity || '0') > 0;
};
```

### Shared methods (on the page object)

Use for navigation/polling sequences used in 2+ places.

```typescript
waitForIncidentsTab: () => {
  cy.waitUntil(() => Cypress.$(_INCIDENTS_TAB_SELECTOR).length > 0, {
    interval: 2000,
    timeout: 180000,
  });
},
```

### Element selectors (on `elements`)

Use when a raw `cy.get('[data-test="..."]')` duplicates an existing
`elements.*` method. Replace with the existing method.

## Step 4: Verify

After refactoring:

1. Run `npx prettier --write <file>` and `npx eslint <file>` — must pass
2. Run the incident test suite to verify no behavioral changes:
   ```bash
   source cypress/export-env.sh && node --max-old-space-size=4096 \
     ./node_modules/.bin/cypress run --browser electron \
     --spec "cypress/e2e/incidents/**/*.cy.ts" \
     --env grepTags="@incidents --@e2e-real --@xfail --@demo"
   ```
3. Verify no new raw selectors were introduced during refactoring

## What NOT to refactor

- **Pre-existing selectors outside your diff** — don't expand scope. Note them
  for a future pass but don't change them in a fix PR.
- **Selectors in `elements` that are already encapsulated** — even if the
  underlying selector is a raw string, the encapsulation point is correct.
- **One-off selectors in test files** — page object cleanup only. Test files
  should call page object methods, but that's a separate refactor.
- **Third-party selectors** (PatternFly, Console SDK) that can't be replaced
  with `data-test` — extract to constants but don't try to add `data-test`
  attributes to upstream components.

## Checklist

Before marking as done, verify:

- [ ] No duplicated selector strings in the added/modified code
- [ ] No raw `cy.get('[data-test="..."]')` that duplicates an `elements.*` method
- [ ] No duplicated filter predicates or polling patterns
- [ ] All extracted constants have descriptive names and comments
- [ ] Lint passes
- [ ] Tests pass
