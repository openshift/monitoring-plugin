export const guidedTour = {
    close: () => {
      cy.get('body').then(($body) => {
        if ($body.find(`[data-test="guided-tour-modal"]`).length > 0) {
          cy.byTestID('tour-step-footer-secondary').contains('Skip tour').click();
        }
      });
    },

    closeKubevirtTour: () => {
      cy.get('body').then(($body) => {
        if ($body.find(`[aria-label="Welcome modal"]`).length > 0) {
          cy.get('[aria-label="Close"]').should('be.visible').click();
        }
      });
    },
  };