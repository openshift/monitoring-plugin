import { WatchdogAlert } from '../../fixtures/monitoring/constants';
import { commonPages } from '../../views/common';
import { listPage } from '../../views/list-page';

// Real Console/Korrel8r smoke; never installs operators or grants permissions.
describe('Merged MCP troubleshooting', { tags: ['@troubleshooting', '@coo'] }, () => {
  // Off unless explicitly enabled, matching the product default.
  const enabled = Cypress.env('TROUBLESHOOTING_ENABLED') === true;
  const base = '/api/plugins/monitoring-console-plugin';
  const korrel8r = '/api/proxy/plugin/monitoring-console-plugin/korrel8r';

  beforeEach(() => {
    cy.login(
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      Cypress.env('LOGIN_PASSWORD'),
      Cypress.env('OAUTH_URL'),
    );
  });

  it('uses only the explicitly enabled merged extensions and proxy', () => {
    cy.request(`${base}/features`).then(({ body }) => {
      expect(Boolean(body.troubleshooting)).to.eq(enabled);
    });
    cy.request(`${base}/plugin-manifest.json`).then(({ body }) => {
      const extensions = body.extensions.filter((extension) =>
        ['TroubleshootingPanelActionsProvider', 'TPReducer', 'NullContextProvider'].some((module) =>
          JSON.stringify(extension).includes(module),
        ),
      );
      expect(extensions).to.have.length(enabled ? 3 : 0);
    });
    cy.intercept(`${korrel8r}/**`).as('mergedKorrel8r');
    cy.intercept(`${korrel8r}/**/graphs/neighbors*`).as('neighbors');
    cy.intercept('/api/proxy/plugin/troubleshooting-panel-console-plugin/**').as('legacyKorrel8r');

    cy.visit('/monitoring/alerts');
    listPage.ARRows.shouldBeLoaded();
    listPage.filter.byName(WatchdogAlert.ALERTNAME);
    listPage.ARRows.expandRow();
    listPage.ARRows.clickAlert();
    commonPages.titleShouldHaveText(WatchdogAlert.ALERTNAME);

    if (!enabled) {
      cy.contains('button', 'Troubleshooting Panel').should('not.exist');
      cy.get('@mergedKorrel8r.all').should('have.length', 0);
      cy.get('@legacyKorrel8r.all').should('have.length', 0);
      return;
    }
    cy.byButtonText('Troubleshooting Panel').should('be.visible').click();
    cy.get('.tp-plugin__popover').should('be.visible');
    cy.wait('@neighbors').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
    });
    cy.get('@legacyKorrel8r.all').should('have.length', 0);
  });
});
