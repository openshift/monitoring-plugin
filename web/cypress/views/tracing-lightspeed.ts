// Lightspeed/OLS helper functions and constants
// Based on lightspeed-console/tests/tests/lightspeed-install.cy.ts

// OLS UI Selectors - reusable across tests
export const OLS_SELECTORS = {
  popover: '.ols-plugin__popover',
  mainButton: '.ols-plugin__popover-button',
  minimizeButton: '.ols-plugin__popover-control[title=Minimize]',
  promptInput: '.ols-plugin__popover textarea, #ols-plugin__prompt-input',
};

export const OLS_TEXT = {
  footerText: 'Always review AI generated content prior to use.',
  privacyText:
    "OpenShift Lightspeed uses AI technology to help answer your questions. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.",
};

export const olsHelpers = {
  /**
   * Open the Lightspeed popover panel
   */
  openPopover: () => {
    cy.get(OLS_SELECTORS.mainButton).click();
    cy.get(OLS_SELECTORS.popover).should('be.visible');
  },

  /**
   * Close the Lightspeed popover panel
   */
  closePopover: () => {
    cy.get(OLS_SELECTORS.minimizeButton).click();
    cy.get(OLS_SELECTORS.popover).should('not.exist');
  },

  /**
   * Submit a prompt in Lightspeed popover
   * Supports both old and new Lightspeed versions
   */
  submitPrompt: () => {
    cy.log('Submit the query (support both old and new Lightspeed versions)');

    // Try button click for older versions, fallback to Enter key for newer versions
    cy.get('body').then(($body) => {
      if ($body.find('button.ols-plugin__chat-prompt-button').length > 0) {
        cy.log('Using button click (older Lightspeed version)');
        cy.get('button.ols-plugin__chat-prompt-button').should('be.visible').click();
      } else {
        cy.log('Using Enter key (newer Lightspeed version)');
        cy.get(OLS_SELECTORS.promptInput).should('be.visible').type('{enter}');
      }
    });
  },

  /**
   * Wait for AI response to be visible
   * Supports both old (.pf-chatbot__message--bot) and new (.ols-plugin__chat-entry--ai)
   * Lightspeed versions
   * @param timeout - Maximum time to wait for response in milliseconds (default: 30000)
   */
  waitForAIResponse: (timeout = 30000) => {
    cy.log('Wait for AI response (support both old and new Lightspeed versions)');

    // Check for both old and new selectors
    cy.get('body', { timeout }).then(($body) => {
      if ($body.find('.ols-plugin__chat-entry--ai').length > 0) {
        cy.log('Found AI response using new selector (.ols-plugin__chat-entry--ai)');
        return cy.get('.ols-plugin__chat-entry--ai', { timeout }).should('be.visible');
      } else if ($body.find('.pf-chatbot__message--bot').length > 0) {
        cy.log('Found AI response using old selector (.pf-chatbot__message--bot)');
        return cy.get('.pf-chatbot__message--bot', { timeout }).should('be.visible');
      } else {
        // Fallback: wait for either selector with a combined selector
        cy.log('Waiting for AI response with combined selector');
        return cy
          .get('.ols-plugin__chat-entry--ai, .pf-chatbot__message--bot', { timeout })
          .should('be.visible');
      }
    });
  },

  /**
   * Get the AI response message element
   * Supports both old and new Lightspeed versions
   */
  getAIResponse: () => {
    cy.log('Get AI response (support both old and new Lightspeed versions)');

    // Return the appropriate selector based on what's in the DOM
    return cy.get('body').then(($body) => {
      if ($body.find('.ols-plugin__chat-entry--ai').length > 0) {
        return cy.get('.ols-plugin__chat-entry--ai');
      } else {
        return cy.get('.pf-chatbot__message--bot');
      }
    });
  },

  /**
   * Wait for Lightspeed popover to appear and close it
   * Useful after Lightspeed operator installation when popover opens by default
   * Does not fail if popover is not found within the timeout period
   * @param timeout - Maximum time to wait for popover in milliseconds (default: 2 minutes)
   */
  waitForPopoverAndClose: (timeout = 120000) => {
    cy.log('Waiting for Lightspeed popover to appear after installation...');

    // Wait for page to be fully loaded
    cy.get('body').should('be.visible');

    const checkInterval = 2000; // Check every 2 seconds
    const maxAttempts = Math.ceil(timeout / checkInterval);

    const checkForPopover = (attempt) => {
      cy.get('body').then(($body) => {
        const $popover = $body.find(OLS_SELECTORS.popover).filter(':visible');

        if ($popover.length > 0) {
          cy.log('Lightspeed popover found, closing it');
          cy.get(OLS_SELECTORS.minimizeButton).click();
          cy.get(OLS_SELECTORS.popover).should('not.exist');
          cy.log('Lightspeed popover closed successfully');
        } else if (attempt + 1 < maxAttempts) {
          // Popover not found yet, retry
          cy.wait(checkInterval);
          checkForPopover(attempt + 1);
        } else {
          // Max attempts reached
          cy.log('Lightspeed popover not found after maximum attempts, continuing...');
        }
      });
    };

    // Start checking for the popover
    checkForPopover(0);
  },

  /**
   * Send a prompt to Lightspeed
   * @param prompt - The prompt text to send
   */
  sendPrompt: (prompt: string) => {
    cy.get(OLS_SELECTORS.promptInput).type(`${prompt}{enter}`);
  },

  /**
   * Verify Lightspeed popover is visible with expected content
   */
  verifyPopoverVisible: () => {
    cy.get(OLS_SELECTORS.popover)
      .should('exist')
      .should('include.text', OLS_TEXT.footerText)
      .should('include.text', OLS_TEXT.privacyText);
  },
};
