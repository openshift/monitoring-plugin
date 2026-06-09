import { operatorAuthUtils } from '../../support/commands/auth-commands';

const PROMPT = 'visualize CPU consumption in the openshift-monitoring namespace in last 2 hours';

// LLM responses can be slow under CI load or cold-start conditions
const OLS_RESPONSE_TIMEOUT = 120_000;

// Selectors prefixed with ols-plugin__ are defined in the OLS plugin repo (openshift-lightspeed)
const SEL = {
  chatButton: '[data-test="ols-plugin__popover-button"]',
  chatPanel: '[data-test="ols-plugin__popover"]',
  modeToggle: '[data-test="ols-plugin__mode-toggle"]',
  promptTextarea: '[data-test="ols-plugin__popover"] .ols-plugin__prompt textarea',
  sendButton: '[data-test="ols-plugin__popover"] button[aria-label="Send"]',
  aiResponse: '[data-test="ols-plugin__chat-entry-ai"]',
  persesPanel: '[data-test="ols-plugin__chat-entry-ai"] [class*="MuiPaper"]',
  persesSvg: 'svg path',
};

/**
 * Non-deterministic test: relies on a live LLM (OLS) to produce a show_timeseries
 * tool call. The AI response is not guaranteed to be identical across runs.
 * This test is tagged @ols and must NOT gate CI. It validates the end-to-end
 * integration path: prompt -> tool call -> Perses chart rendering.
 *
 * Prerequisites: COO and OLS operators must be pre-installed.
 * Only authentication is needed — operator lifecycle is not managed here.
 */
describe('COO-LightSpeed: show_timeseries', { tags: ['@ols'] }, () => {
  before(() => {
    operatorAuthUtils.loginAndAuth();
    cy.visit('/');
    cy.reload(true);
  });

  after(() => {
    cy.get('body').then(($body) => {
      if ($body.find(SEL.chatPanel).length > 0) {
        cy.get(SEL.chatButton).click();
      }
    });
  });

  it('switches to troubleshooting mode, sends a prompt, and renders a Perses dashboard', () => {
    cy.get(SEL.chatButton).click();
    cy.get(SEL.chatPanel).should('be.visible');

    cy.get(SEL.modeToggle).click();
    cy.get('[role="option"]').contains('Troubleshooting').click();
    cy.get(SEL.modeToggle).should('contain.text', 'Troubleshooting');

    cy.get(SEL.promptTextarea).clear().type(PROMPT);
    cy.get(SEL.sendButton).click();

    cy.get(SEL.aiResponse, { timeout: OLS_RESPONSE_TIMEOUT }).last().should('be.visible');

    cy.get(SEL.aiResponse, { timeout: OLS_RESPONSE_TIMEOUT })
      .last()
      .find('[class*="label"]')
      .contains('show_timeseries')
      .should('exist');

    cy.get(SEL.persesPanel, { timeout: OLS_RESPONSE_TIMEOUT })
      .should('exist')
      .scrollIntoView()
      .should('be.visible');

    cy.get(SEL.persesPanel).find(SEL.persesSvg).should('exist');

    cy.get(SEL.persesPanel).should('contain.text', 'CPU');
    cy.get(SEL.persesPanel).should('contain.text', 'openshift-monitoring');
    cy.get(SEL.persesPanel).find('svg path[d]').should('have.length.greaterThan', 0);
  });
});
