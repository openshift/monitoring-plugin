export const tracingGuidedTour = {
  close: () => {
    cy.get('body').then(($body) => {
      if ($body.find(`[data-test="guided-tour-modal"]`).length > 0) {
        // Handle both PatternFly v5 and v6 button structures
        // Try multiple selectors to ensure compatibility
        cy.get(
          'button[data-test="tour-step-footer-secondary"], button#tour-step-footer-secondary, button:contains("Skip tour")',
        )
          .first()
          .click();
      }
      // OCP 4.22+ modal overlays (e.g. "Welcome to the new OpenShift experience!")
      else if ($body.find('.pf-v6-c-modal-box, .pf-v5-c-modal-box').length > 0) {
        if (
          $body.find(
            '.pf-v6-c-modal-box button[aria-label="Close"], .pf-v5-c-modal-box button[aria-label="Close"]',
          ).length > 0
        ) {
          cy.get(
            '.pf-v6-c-modal-box button[aria-label="Close"], .pf-v5-c-modal-box button[aria-label="Close"]',
          )
            .first()
            .click({ force: true });
        } else {
          cy.get('.pf-v6-c-modal-box button, .pf-v5-c-modal-box button')
            .not(':contains("Learn")')
            .first()
            .click({ force: true });
        }
      }
    });
  },
  isOpen: () => {
    cy.get('body').then(($body) => {
      if ($body.find(`[data-test="guided-tour-modal"]`).length > 0) {
        cy.byTestID('guided-tour-modal').should('be.visible');
      }
    });
  },
};
