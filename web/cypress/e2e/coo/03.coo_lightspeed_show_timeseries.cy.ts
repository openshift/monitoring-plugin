import { operatorAuthUtils } from '../../support/commands/auth-commands';
import { nav } from '../../views/nav';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesMUIDataTestIDs } from '../../../src/shared/constants/data-test';

const PROMPT = 'visualize CPU consumption in the openshift-monitoring namespace in last 2 hours';

// LLM responses can be slow under CI load or cold-start conditions
const OLS_RESPONSE_TIMEOUT = 120_000;

const DASHBOARD_PROJECT = Cypress.env('COO_NAMESPACE');
const DASHBOARD_NAME = 'OLS-test-dashboard-' + Math.random().toString(36).substring(2, 8);

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
  addToDashboard: '[aria-label="Add to dashboard"]',
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
        cy.get(SEL.chatButton).click({ force: true });
      }
    });

    // Clean up the test dashboard via CLI — more reliable than UI cleanup
    // when modals or overlays may be blocking interaction.
    cy.adminCLI(
      `oc delete persesdashboard -n ${DASHBOARD_PROJECT} -l app.kubernetes.io/managed-by=perses ` +
        `--field-selector metadata.name=${DASHBOARD_NAME} --ignore-not-found`,
    ).then(() => {
      // Fallback: delete any dashboard whose CR name matches the display name pattern
      cy.exec(
        `oc get persesdashboard -n ${DASHBOARD_PROJECT} -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false },
      ).then((result) => {
        if (result.stdout) {
          const dashboards = result.stdout
            .split('\n')
            .filter((d) => d.includes('ols-test-dashboard'));
          dashboards.forEach((d) => {
            cy.adminCLI(`oc delete ${d} -n ${DASHBOARD_PROJECT} --ignore-not-found`);
          });
        }
      });
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

  it('adds the rendered chart to a new Perses dashboard via Add to Dashboard button', () => {
    // Close the chat panel if it is open from the previous test
    cy.get('body').then(($body) => {
      if ($body.find(SEL.chatPanel).length > 0) {
        cy.get(SEL.chatButton).click();
      }
    });

    // Navigate to Dashboards (Perses) and create a new dashboard
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    commonPages.titleShouldHaveText('Dashboards');

    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.selectProject(DASHBOARD_PROJECT);
    persesCreateDashboardsPage.enterDashboardName(DASHBOARD_NAME);
    persesCreateDashboardsPage.createDashboardDialogCreateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(DASHBOARD_NAME);
    persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

    // Save the empty dashboard first so it exits edit mode
    persesDashboardsPage.clickEditActionButton('Save');

    // Open OLS chat and send prompt
    cy.get(SEL.chatButton).click();
    cy.get(SEL.chatPanel).should('be.visible');

    cy.get(SEL.modeToggle).click();
    cy.get('[role="option"]').contains('Troubleshooting').click();
    cy.get(SEL.modeToggle).should('contain.text', 'Troubleshooting');

    cy.get(SEL.promptTextarea).clear().type(PROMPT);
    cy.get(SEL.sendButton).click();

    // Wait for the AI response with show_timeseries tool call
    cy.get(SEL.aiResponse, { timeout: OLS_RESPONSE_TIMEOUT }).last().should('be.visible');

    cy.get(SEL.aiResponse, { timeout: OLS_RESPONSE_TIMEOUT })
      .last()
      .find('[class*="label"]')
      .contains('show_timeseries')
      .should('exist');

    cy.get(SEL.persesPanel, { timeout: OLS_RESPONSE_TIMEOUT }).should('exist');

    // Wait for the streaming response to stabilize before interacting
    cy.wait(5000);

    // The "Add to dashboard" button should be visible because a dashboard is open.
    // The AI may return multiple show_timeseries tool calls, so pick the first one.
    // The button may be inside a collapsed tool-call accordion in the OLS chat,
    // so use force:true to click it regardless of visibility.
    cy.get(SEL.aiResponse).last().find(SEL.addToDashboard).first().click({ force: true });

    // Close the chat panel to see the dashboard
    cy.get(SEL.chatButton).click();

    // The dashboard should have entered edit mode and the panel should be added
    cy.wait(5000);

    // Verify a panel was added to the dashboard
    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').should('be.visible');

    // Save the dashboard with the added panel
    persesDashboardsPage.clickEditActionButton('Save');

    // Verify the panel persists after save
    cy.byDataTestID(persesMUIDataTestIDs.panelHeader).find('h6').should('be.visible');
  });
});
