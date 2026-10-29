import { TestIds } from '@/features/logging/utils/test-ids';

// Real Console/Loki smoke; never installs operators or grants permissions.
describe('Merged MCP logging', { tags: ['@logging', '@coo'] }, () => {
  const enabled = Cypress.env('LOGGING_ENABLED') !== false;
  const base = '/api/plugins/monitoring-console-plugin';
  const loki = '/api/proxy/plugin/monitoring-console-plugin/loki';

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
      expect(Boolean(body.logging)).to.eq(enabled);
    });
    cy.request(`${base}/plugin-manifest.json`).then(({ body }) => {
      const extensions = body.extensions.filter((extension) =>
        [
          'LogsPage',
          'LogsDetailPage',
          'LogsDevPage',
          'LogsAlertMetrics',
          'getUserAlertingRules',
          'getPlatformAlertingRules',
        ].some((module) => JSON.stringify(extension).includes(module)),
      );
      expect(extensions).to.have.length(enabled ? 9 : 0);
    });
    cy.intercept(`${loki}/**`).as('mergedLoki');
    cy.intercept('/api/proxy/plugin/logging-view-plugin/**').as('legacyLoki');
    if (!enabled) {
      cy.visit('/');
      cy.get('a[href="/monitoring/logs"]').should('not.exist');
      cy.get('@mergedLoki.all').should('have.length', 0);
      cy.get('@legacyLoki.all').should('have.length', 0);
      return;
    }
    const params = new URLSearchParams({
      tenant: Cypress.env('LOGGING_TENANT') || 'application',
      schema: Cypress.env('LOGGING_SCHEMA') || 'viaq',
    });
    if (Cypress.env('LOGGING_QUERY')) params.set('q', Cypress.env('LOGGING_QUERY'));
    cy.intercept(`${loki}/**/query_range?*`).as('logs');
    cy.visit(`/monitoring/logs?${params}`);
    cy.wait('@logs').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      expect(response?.body.status).to.eq('success');
    });
    cy.byTestID(TestIds.LogsTable).should('be.visible');
    cy.get('@legacyLoki.all').should('have.length', 0);
  });
});
