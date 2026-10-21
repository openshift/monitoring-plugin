import { TestIds } from '@/features/logging/utils/test-ids';
import {
  queryRangeMatrixValidResponse,
  queryRangeStreamsValidResponse,
} from '../fixtures/query-range-fixtures';
import { podsLabelValuesResponse } from '../fixtures/resource-api-fixtures';

Cypress.Keyboard.defaults({
  keystrokeDelay: 40,
});

const LOGS_DEV_PAGE_URL = '/dev-monitoring/ns/my-namespace/logs';
const QUERY_RANGE_STREAMS_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=%7B*';
const QUERY_RANGE_MATRIX_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=sum*';
const QUERY_RANGE_STREAMS_INFRASTRUCTURE_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure/loki/api/v1/query_range?query=%7B*';
const QUERY_RANGE_MATRIX_INFRASTRUCTURE_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure/loki/api/v1/query_range?query=sum*';
const TEST_MESSAGE = "loki_1 | level=info msg='test log'";
const LABEL_POD_VALUES_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/label/kubernetes_pod_name/values?*';

describe('Logs Dev Page', () => {
  it('renders correctly with an expected response', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    );
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.RefreshIntervalDropdown).should('exist');
    cy.byTestID(TestIds.TimeRangeDropdown).should('exist');
    cy.byTestID(TestIds.SyncButton).should('exist');
    cy.byTestID(TestIds.LogsQueryInput).should('not.exist');

    cy.byTestID(TestIds.ShowQueryToggle).click();
    cy.byTestID(TestIds.LogsQueryInput).should('exist');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });
  });

  it('executes a query when "run query" is pressed', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
  });

  it('executes a query with a new value when "Enter" is pressed on the query input field', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.ShowQueryToggle).click();

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .type('{selectAll}')
        .type('{ job = "some_job" }', {
          parseSpecialCharSequences: false,
        })
        .type('{enter}');
    });

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
  });

  it('executes a query when severity is changed', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.SeverityDropdown).within(() => {
      cy.get('button').should('not.be.disabled').click();
    });
    cy.contains('warning').click();

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
  });

  it('executes a query including the current namespace', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.wait('@queryRangeStreams').then(({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query');
      expect(query).to.equal('{ kubernetes_namespace_name="my-namespace" } | json');
    });

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);
  });

  it('executes a new query when the current namespace changes', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.wait('@queryRangeStreams').then(({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query');
      expect(query).to.equal('{ kubernetes_namespace_name="my-namespace" } | json');
    });

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.NamespaceToggle).click();
    cy.byTestID(TestIds.NamespaceDropdown).contains('my-namespace-two').click();

    cy.wait('@queryRangeStreams').then(({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query');
      expect(query).to.equal('{ kubernetes_namespace_name="my-namespace-two" } | json');
    });
  });

  it('executes a query with infra logs when the current namespace changes', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.intercept(
      QUERY_RANGE_STREAMS_INFRASTRUCTURE_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreamsInfrastructure');
    cy.intercept(QUERY_RANGE_MATRIX_INFRASTRUCTURE_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrixInfrastructure',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.wait('@queryRangeStreams').then(({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query');
      expect(query).to.equal('{ kubernetes_namespace_name="my-namespace" } | json');
    });

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.NamespaceToggle).click();
    cy.byTestID(TestIds.NamespaceDropdown).contains('openshift-cluster-version').click();

    cy.wait('@queryRangeStreamsInfrastructure').then(({ request }) => {
      const url = new URL(request.url);
      const pathname = url.pathname;
      expect(pathname).to.equal(
        '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure/loki/api/v1/query_range',
      );
      const query = url.searchParams.get('query');
      expect(query).to.equal('{ kubernetes_namespace_name="openshift-cluster-version" } | json');
    });
  });

  it('executes a namespace-scoped pods list query when selecting the pods filter', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );
    cy.intercept(LABEL_POD_VALUES_URL_MATCH, podsLabelValuesResponse).as('resourceQuery');

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).click({ force: true });
    });
    cy.get('[role="option"]').contains('Pods').click({ force: true });
    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input').invoke('attr', 'placeholder').should('contain', 'Filter by Pods');
      cy.byTestID(TestIds.AttributeOptions).within(() => {
        cy.get('button').click({ force: true });
      });
    });
    cy.contains('my-pod').click({ force: true });

    cy.wait('@resourceQuery').then(({ request }) => {
      const url = new URL(request.url);
      expect(url.pathname).to.equal(
        '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/label/kubernetes_pod_name/values',
      );
    });
  });

  it('displays an error when there are no permissions over namespace pods', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );
    cy.intercept(LABEL_POD_VALUES_URL_MATCH, {
      statusCode: 403,
      body: 'You are not authorized to list pods in this namespace',
    }).as('resourceQuery');
    cy.intercept('/api/kubernetes/api/v1/namespaces/my-namespace/pods', {
      statusCode: 403,
      body: 'You are not authorized to list pods in this namespace',
    }).as('k8sPodsQuery');

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).click({ force: true });
    });
    cy.get('[role="option"]').contains('Pods').click({ force: true });
    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input').invoke('attr', 'placeholder').should('contain', 'Filter by Pods');
      cy.byTestID(TestIds.AttributeOptions).within(() => {
        cy.get('button').click({ force: true });
      });
    });
    cy.contains('You are not authorized to list pods in this namespace');

    cy.byTestID(TestIds.AttributeFilters).within(() => {});
  });

  it('displays log based metrics when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.LogsMetrics).should('exist');
  });

  it('loads the current namespace as a filter in the query', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea').contains('kubernetes_namespace_name="my-namespace"');
    });
  });

  it('updates the query to include the current selected namespace as a filter', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea').contains('kubernetes_namespace_name="my-namespace"');
    });

    cy.byTestID(TestIds.NamespaceToggle).click();
    cy.byTestID(TestIds.NamespaceDropdown).contains('my-namespace-two').click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea').contains('kubernetes_namespace_name="my-namespace-two"');
    });
  });

  it('disables the run query button when there is no selected namespace', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea').type('{selectAll}').type('{backspace}').type('{ job = "some_job" }', {
        parseSpecialCharSequences: false,
      });
    });

    cy.byTestID(TestIds.ExecuteQueryButton).should('be.disabled');

    cy.contains('Please select a namespace');
  });

  it('displays log based metrics when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.LogsMetrics).should('exist');
  });

  it('histogram is disabled and not visible when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.byTestID(TestIds.LogsMetrics).should('exist');
    cy.byTestID(TestIds.ToggleHistogramButton).should('be.disabled');
    cy.byTestID(TestIds.LogsHistogram).should('not.exist');
  });

  it('histogram is disabled after beign enabled by a streams result when query results are matrix type', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_DEV_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });

    cy.byTestID(TestIds.ShowQueryToggle).click();

    const matrixQuery =
      'sum by (level) (count_over_time({ kubernetes_namespace_name="my-namespace" })[10m])';

    cy.setLogQueryInput(matrixQuery);

    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as('executeMatrix');
    cy.byTestID(TestIds.ExecuteQueryButton).should('be.enabled').click();

    cy.wait('@executeMatrix');

    cy.byTestID(TestIds.LogsMetrics).should('exist');
    cy.byTestID(TestIds.ToggleHistogramButton).should('be.disabled');
    cy.byTestID(TestIds.LogsHistogram).should('not.exist');

    cy.byTestID(TestIds.LogsQueryInput).should('not.have.attr', 'data-test-query', matrixQuery);

    const streamsQuery = '{ kubernetes_namespace_name="my-namespace" }';

    cy.setLogQueryInput(streamsQuery);

    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('executeStreams');
    cy.byTestID(TestIds.ExecuteQueryButton).should('be.enabled').click();

    cy.wait('@executeStreams');

    cy.byTestID(TestIds.LogsMetrics).should('not.exist');
    cy.byTestID(TestIds.ToggleHistogramButton).should('be.enabled');
    cy.byTestID(TestIds.ToggleHistogramButton).click();
    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });
  });
});
