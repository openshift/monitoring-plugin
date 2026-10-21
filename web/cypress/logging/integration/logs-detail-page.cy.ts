import { TestIds } from '@/features/logging/utils/test-ids';
import {
  queryRangeMatrixValidResponse,
  queryRangeStreamsValidResponse,
} from '../fixtures/query-range-fixtures';

Cypress.Keyboard.defaults({
  keystrokeDelay: 40,
});

const LOGS_DETAIL_PAGE_URL = '/k8s/ns/my-namespace/pods/test-pod-name';
const LOGS_DETAIL_PAGE_URL_OPENSHIFT_NS = '/k8s/ns/openshift-api/pods/test-pod-name';
const QUERY_RANGE_MATRIX_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=sum*';
const QUERY_RANGE_STREAMS_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=%7B*';
const QUERY_RANGE_STREAMS_INFRASTRUCTURE_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure/loki/api/v1/query_range?query=%7B*';
const TEST_MESSAGE = "loki_1 | level=info msg='test log'";

describe('Logs Detail Page', () => {
  it('executes a query when "run query" is pressed', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('executes a query with a new value when "Enter" is pressed on the query input field', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .type('{selectAll}')
        .type('{ job = "some_job" }', {
          parseSpecialCharSequences: false,
        })
        .type('{enter}');
    });

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('executes a query when severity is changed', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.SeverityDropdown).click();
    cy.contains('warning').click();

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('disables query executors when the query is empty', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea').clear();
    });

    cy.byTestID(TestIds.ExecuteQueryButton).should('be.disabled');

    cy.byTestID(TestIds.ToogleStreamingButton).should('be.disabled');

    cy.byTestID(TestIds.SeverityDropdown).within(() => {
      cy.get('button').should('be.disabled');
    });
  });

  it('executes a query for the applications tenant based on the namespace', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('executes a query for the infrastructure tenant based on the namespace', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_INFRASTRUCTURE_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreamsInfrastructure');

    cy.visit(LOGS_DETAIL_PAGE_URL_OPENSHIFT_NS);

    cy.get('@queryRangeStreamsInfrastructure.all').should('have.length.at.least', 1);

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);
  });

  it('displays log based metrics when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeStreams',
    );

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LogsMetrics).should('exist');
  });

  it('histogram is disabled and not visible when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeStreams',
    );

    cy.visit(LOGS_DETAIL_PAGE_URL);

    cy.wait('@queryRangeStreams');

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

    cy.visit(LOGS_DETAIL_PAGE_URL);

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

    const streamsQuery = '{ kubernetes_namespace_name="my-namespace" }';

    cy.setLogQueryInput(streamsQuery);

    // Re-alias so the wait targets this execution's streams request rather than a
    // stale one (initial load or histogram toggle) still held by the shared alias.
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
