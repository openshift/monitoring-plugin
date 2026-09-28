---
name: refactor-regression-test
description: Refactor an existing Incidents Cypress regression test while preserving behavior and its manual-verification state. Use when the user asks to clean up or reorganize such a test.
---

# Refactor an Incidents regression test

Require the target test file. Before editing, read:

- `.agents/references/incidents-testing-guidelines.md`;
- `web/cypress/views/incidents-page.ts`;
- the target test and related fixture;
- [references/refactoring-guide.md](references/refactoring-guide.md) for preserved examples and checks.

Reduce repetition and improve naming without weakening assertions or changing the scenario. Reuse existing page-object APIs. Ask before adding missing page-object functionality.

Preserve the test's `cy.pause()` state. Remove pauses only when the user explicitly requests or confirms their removal, and never reintroduce pauses into a test from which they were already removed.

Run the narrowest relevant checks and summarize structural changes separately from behavior changes.
