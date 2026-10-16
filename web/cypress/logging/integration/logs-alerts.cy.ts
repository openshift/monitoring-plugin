import { TestIds } from '@/features/logging/test-ids';
import {
  queryRangeMatrixEmptyResponse,
  queryRangeMatrixInvalidResponse,
  queryRangeMatrixValidResponse,
} from '../fixtures/query-range-fixtures';

Cypress.Keyboard.defaults({
  keystrokeDelay: 40,
});

const LOGS_ALERTS_PAGE_URL = '/monitoring/alerts/test-alert';
const QUERY_RANGE_MATRIX_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=sum*';

describe('Alerts logs metrics', () => {
  it('renders correctly with an expected response', () => {
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_ALERTS_PAGE_URL);

    cy.byTestID(TestIds.TimeRangeDropdown).should('exist');

    cy.byTestID(TestIds.LogsMetrics)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });
  });

  it('handles errors gracefully when a request fails', () => {
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, (req) => {
      req.continue((res) => res.send({ statusCode: 500, body: 'Internal Server Error' }));
    });

    cy.visit(LOGS_ALERTS_PAGE_URL);

    cy.byTestID(TestIds.LogsMetrics)
      .should('exist')
      .within(() => {
        cy.contains('Internal Server Error');
      });
  });

  it('handles errors gracefully when a response is invalid', () => {
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixInvalidResponse());

    cy.visit(LOGS_ALERTS_PAGE_URL);

    cy.byTestID(TestIds.LogsMetrics)
      .should('exist')
      .within(() => {
        cy.contains('Unexpected end of JSON input');
      });
  });

  it('handles errors gracefully when a response is empty', () => {
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixEmptyResponse());

    cy.visit(LOGS_ALERTS_PAGE_URL);

    cy.byTestID(TestIds.LogsMetrics)
      .should('exist')
      .within(() => {
        cy.contains('No datapoints found');
      });
  });

  it('executes a new query when a new time range is selected', () => {
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_ALERTS_PAGE_URL);

    cy.byTestID(TestIds.TimeRangeDropdown).within(() => {
      cy.get('button').click(); // Open the dropdown
    });
    cy.contains('Last 6 hours').click(); // Select from opened dropdown

    cy.wait(200);

    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 2);
  });
});
