import { DataTestIDs, Classes } from "../../src/components/data-test";

export const acmAlertingPage = {
  shouldBeLoaded: () => {
    cy.log('acmAlertingPage.shouldBeLoaded');
    cy.get('[data-test-id="horizontal-link-Alerts"]', { timeout: 60000 })
      .contains('Alerts')
      .should('be.visible');
  },
};
