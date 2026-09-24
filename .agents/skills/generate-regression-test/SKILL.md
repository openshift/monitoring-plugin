---
name: generate-regression-test
description: Generate an Incidents Cypress regression test from a documented test-flow section. Use when the user names a section under docs/incident_detection/tests or asks to automate one.
---

# Generate an Incidents regression test

Require a section identifier or an unambiguous documented flow. Before editing, read:

- `.agents/references/incidents-testing-guidelines.md`;
- the matching file under `docs/incident_detection/tests/`;
- `web/cypress/views/incidents-page.ts`;
- nearby tests under `web/cypress/e2e/incidents/regression/`;
- [references/generation-guide.md](references/generation-guide.md) for the preserved detailed workflow and examples.

Reuse an existing fixture when suitable. If a new fixture is required, explain the required data and obtain the user's approval before creating it; then read `.agents/skills/generate-incident-fixture/SKILL.md` and follow that workflow.

Use existing page-object selectors and methods. If required page-object support is missing, propose the addition and wait for approval before changing the page object. Preserve the current policy of automated assertions plus `cy.pause()` at key verification points for newly generated tests.

Run the narrowest relevant formatting, type, or Cypress check available, then report the generated file, fixture use, and anything still requiring manual verification.
