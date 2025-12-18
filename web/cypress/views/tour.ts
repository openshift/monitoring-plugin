export const guidedTour = {
    close: () => {
      const modalSelector = 'button[data-ouia-component-id="clustersOnboardingModal-ModalBoxCloseButton"]'
      cy.log('close guided tour');
      cy.get('body').then(($body) => {
        //Core platform modal
        if ($body.find(`[data-test="guided-tour-modal"]`).length > 0) {
          cy.log('Core platform modal detected, attempting to close...');
          cy.byTestID('tour-step-footer-secondary').contains('Skip tour').click();
        } 
        //Kubevirt modal
        else if ($body.find(`[aria-label="Welcome modal"]`).length > 0) {
          cy.log('Kubevirt modal detected, attempting to close...');
          cy.get('[aria-label="Close"]').should('be.visible').click();
        } 
        //ACM Onboarding modal
        else if ($body.find(modalSelector).length > 0) {
          cy.log('Onboarding modal detected, attempting to close...');
          cy.get(modalSelector, { timeout: 20000 })
            .should('be.visible')
            .should('not.be.disabled')
            .click({ force: true });
    
          cy.get(modalSelector, { timeout: 10000 })
            .should('not.exist')
            .then(() => cy.log('Modal successfully closed'));
        }
        // Prevents navigating away from the page before the tour is closed
        cy.wait(2000);
      });
    },

    closeKubevirtTour: () => {
      cy.log('close Kubevirt tour');
      cy.get('body').then(($body) => {
        if ($body.find(`[aria-label="Welcome modal"]`).length > 0) {
          cy.get('[aria-label="Close"]').should('be.visible').click();
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
      });
    },
  };