export const guidedTour = {
    close: () => {
      cy.get('body').then(($body) => {
        if ($body.find(`[data-test="guided-tour-modal"]`).length > 0) {
          cy.byTestID('tour-step-footer-secondary').contains('Skip tour').click();
        }
        // Prevents navigating away from the page before the tour is closed
        cy.wait(2000);
      });
    },

    closeKubevirtTour: () => {
      cy.get('body').then(($body) => {
        if ($body.find(`[aria-label="Welcome modal"]`).length > 0) {
          cy.get('[aria-label="Close"]').should('be.visible').click();
        }
        // Prevents navigating away from the page before the tour is closed
        cy.wait(2000);
      });
    },
  };