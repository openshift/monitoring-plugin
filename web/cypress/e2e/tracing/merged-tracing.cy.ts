import { listPage } from '../../views/list-page';

// Real Console/Tempo smoke; never installs operators or grants permissions.
// Preconditions: the Console under test loads monitoring-console-plugin but not the legacy
// distributed-tracing-console-plugin (e.g. the local bridge from `make start-coo-console`), and
// for the enabled run the Tempo operator CRDs are installed.
// Disabled (default): `npm run test-cypress-tracing`.
// Enabled: `npm run test-cypress-tracing -- --env TRACING_ENABLED=true`; optionally add
// TRACING_TEMPO_INSTANCE=<namespace>/<name> and TRACING_TEMPO_TENANT=<tenant> to also run a search.
describe('Merged MCP tracing', { tags: ['@tracing', '@coo'] }, () => {
  // Off unless explicitly enabled, matching the product default.
  const enabled = Cypress.env('TRACING_ENABLED') === true;
  const base = '/api/plugins/monitoring-console-plugin';
  const backend = '/api/proxy/plugin/monitoring-console-plugin/backend';

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
      expect(Boolean(body.tracing)).to.eq(enabled);
    });
    cy.request(`${base}/plugin-manifest.json`).then(({ body }) => {
      const extensions = body.extensions.filter(
        (extension) =>
          extension.properties?.id === 'distributed-tracing' ||
          ['TracesPage', 'TraceDetailPage'].includes(extension.properties?.component?.$codeRef),
      );
      expect(extensions).to.have.length(enabled ? 3 : 0);
    });
    cy.intercept(`${backend}/api/v1/list-tempo-resources`).as('tempoResources');
    cy.intercept(`${backend}/proxy/**`).as('tempoProxy');
    cy.intercept('/api/proxy/plugin/distributed-tracing-console-plugin/**').as('legacyBackend');

    if (!enabled) {
      cy.visit('/monitoring/alerts');
      listPage.ARRows.shouldBeLoaded();
      cy.get('a[href="/observe/traces"]').should('not.exist');
      cy.get('@tempoResources.all').should('have.length', 0);
      cy.get('@tempoProxy.all').should('have.length', 0);
      cy.get('@legacyBackend.all').should('have.length', 0);
      return;
    }
    const [namespace, name] = (Cypress.env('TRACING_TEMPO_INSTANCE') || '').split('/');
    const tenant = Cypress.env('TRACING_TEMPO_TENANT');
    const search = Boolean(namespace && name && tenant);
    const params = new URLSearchParams(search ? { namespace, name, tenant } : {});
    if (search) {
      cy.intercept({ pathname: `${backend}/proxy/${namespace}/${name}/${tenant}/api/search` }).as(
        'search',
      );
    }

    cy.visit(`/observe/traces?${params}`);
    cy.wait('@tempoResources').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      expect(response?.body.status).to.eq('success');
    });
    cy.contains('h1', 'Traces').should('be.visible');
    cy.get('a[href="/observe/traces"]').should('exist');
    if (search) {
      cy.wait('@search').then(({ response }) => {
        expect(response?.statusCode).to.eq(200);
      });
    }
    cy.get('@legacyBackend.all').should('have.length', 0);
  });
});
