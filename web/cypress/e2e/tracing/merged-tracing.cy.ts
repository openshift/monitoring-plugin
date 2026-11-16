import { listPage } from '../../views/list-page';

type SearchInterception = {
  response?: { statusCode: number; body: { traces?: { traceID: string }[] } };
};

// Real Console/Tempo smoke; never installs operators or grants permissions.
// Preconditions: the Console under test loads monitoring-console-plugin but not the legacy
// distributed-tracing-console-plugin (e.g. the local bridge from `make start-coo-console`), and
// for the enabled run the selected multi-tenant Tempo instance must contain recent traces.
// Disabled (default): `npm run test-cypress-tracing`.
// Enabled: `npm run test-cypress-tracing -- --env TRACING_ENABLED=true,` followed by
// TRACING_TEMPO_INSTANCE=<namespace>/<name>,TRACING_TEMPO_TENANT=<tenant> (both required).
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
    const tenant = Cypress.env('TRACING_TEMPO_TENANT') || '';
    expect(namespace, 'TRACING_TEMPO_INSTANCE namespace is required')
      .to.be.a('string')
      .and.have.length.greaterThan(0);
    expect(name, 'TRACING_TEMPO_INSTANCE name is required')
      .to.be.a('string')
      .and.have.length.greaterThan(0);
    expect(tenant, 'TRACING_TEMPO_TENANT is required')
      .to.be.a('string')
      .and.have.length.greaterThan(0);
    const params = new URLSearchParams({ namespace, name, tenant });
    const tempoProxy =
      `${backend}/proxy/${encodeURIComponent(namespace)}/` +
      `${encodeURIComponent(name)}/${encodeURIComponent(tenant)}`;
    cy.intercept({ method: 'GET', pathname: `${tempoProxy}/api/search` }).as('search');

    cy.visit(`/observe/traces?${params}`);
    cy.wait('@tempoResources').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      expect(response?.body.status).to.eq('success');
    });
    cy.contains('h1', 'Traces').should('be.visible');
    cy.get('a[href="/observe/traces"]').should('exist');
    cy.wait('@search').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      expect(response?.body.traces, 'selected tenant must contain recent traces')
        .to.be.an('array')
        .and.have.length.greaterThan(0);
    });
    // The chart and table can issue separate searches with different result sets.
    // Open a rendered table result, not an arbitrary trace from the first response.
    cy.get('.dt-plugin-trace-table a[href^="/observe/traces/"]')
      .first()
      .should('be.visible')
      .invoke('attr', 'href')
      .then((href) => {
        const pathname = new URL(href, Cypress.config('baseUrl')).pathname;
        const traceId = pathname.split('/').pop();
        expect(traceId, 'rendered trace ID').to.match(/^[a-f0-9]+$/i);
        cy.get<SearchInterception[]>('@search.all').should((searches) => {
          expect(
            searches.some(
              ({ response }) =>
                response?.statusCode === 200 &&
                response.body.traces?.some((trace) => trace.traceID === traceId),
            ),
            'rendered trace belongs to a successful MCP search response',
          ).to.eq(true);
        });
        cy.intercept({ method: 'GET', pathname: `${tempoProxy}/api/v2/traces/${traceId}` }).as(
          'traceDetail',
        );
        cy.get(`.dt-plugin-trace-table a[href="${href}"]`).first().click();
        cy.location('pathname').should('eq', pathname);
        cy.wait('@traceDetail').then(({ response: detail }) => {
          expect(detail?.statusCode).to.eq(200);
          expect(detail?.body.trace.resourceSpans, 'trace detail contains spans')
            .to.be.an('array')
            .and.have.length.greaterThan(0);
        });
        cy.get('[data-testid="span-duration-bar"]').first().should('be.visible');
      });
    cy.get('@legacyBackend.all').should('have.length', 0);
  });
});
