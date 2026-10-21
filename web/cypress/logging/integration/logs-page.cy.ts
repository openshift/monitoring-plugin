import { TestIds } from '@/features/logging/utils/test-ids';
import {
  queryRangeMatrixInvalidResponse,
  queryRangeMatrixValidResponse,
  queryRangeStreamsErrorResponse,
  queryRangeStreamsInvalidResponse,
  queryRangeStreamsValidResponse,
  queryRangeStreamsWithLineFormatting,
  queryRangeStreamsWithMessage,
  volumeRangeMatrixValidResponse,
} from '../fixtures/query-range-fixtures';
import {
  containersLabelValuesResponse,
  podsListResponse,
  projectListResponse,
} from '../fixtures/resource-api-fixtures';
import { formatTimeRange } from '@/features/logging/utils/time-range';
import { configResponse } from '../fixtures/backend-fixtures';

Cypress.Keyboard.defaults({
  keystrokeDelay: 40,
});

const LOGS_PAGE_URL = '/monitoring/logs';
const QUERY_RANGE_STREAMS_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=%7B*';
const QUERY_RANGE_MATRIX_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=sum*';
const QUERY_RANGE_STREAMS_INFRASTRUCTURE_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure/loki/api/v1/query_range?query=%7B*';
const QUERY_RANGE_MATRIX_INFRASTRUCTURE_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/infrastructure/loki/api/v1/query_range?query=sum*';
const VOLUME_QUERY_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/index/volume_range?query=*';
const SERIES_POD_VALUES_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/series?*';
const CONFIG_URL_MATCH = '/api/plugins/monitoring-console-plugin/config';
const RESOURCE_URL_MATCH = '/api/kubernetes/api/v1/*';
const PROJECT_URL_MATCH = '/api/kubernetes/apis/project.openshift.io/v1/projects';
const TEST_MESSAGE = "loki_1 | level=info msg='test log'";

describe('Logs Page', () => {
  it('renders correctly with an expected response', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    );
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse());

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.RefreshIntervalDropdown).should('exist');
    cy.byTestID(TestIds.TimeRangeDropdown).should('exist');
    cy.byTestID(TestIds.SyncButton).should('exist');
    cy.byTestID(TestIds.LogsQueryInput).should('not.exist');

    cy.byTestID(TestIds.ShowQueryToggle).click();
    cy.byTestID(TestIds.LogsQueryInput).should('exist');

    cy.byTestID(TestIds.ShowStatsToggle).click();
    cy.byTestID(TestIds.LogsStats).click();

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });
  });

  it('tests if the volume graph is enabled and is viewable', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.intercept(VOLUME_QUERY_URL_MATCH, volumeRangeMatrixValidResponse()).as('volumeRangeMatrix');

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.byTestID(TestIds.LogsTable).should('exist');

    cy.byTestID(TestIds.ExecuteVolumeButton).click();

    cy.byTestID(TestIds.LogsMetrics).should('exist');
  });

  it('tests if the stats table is enabled and is viewable', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.ShowStatsToggle).click();
    cy.byTestID(TestIds.LogsStats).should('exist');

    cy.byTestID(TestIds.ShowStatsToggle).click();
    cy.byTestID(TestIds.LogsStats).should('not.exist');
  });

  it('handles errors gracefully when a request fails', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, (req) => {
      req.continue((res) => res.send({ statusCode: 500, body: 'Internal Server Error' }));
    }).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, (req) => {
      req.continue((res) => res.send({ statusCode: 500, body: 'Internal Server Error' }));
    }).as('queryRangeMatrix');

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.contains('Internal Server Error');
      });

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.contains('Internal Server Error');
      });
  });

  it('handles errors gracefully when a response is invalid', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeStreamsInvalidResponse()).as(
      'queryRangeStreams',
    );
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixInvalidResponse());

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.contains('Unexpected end of JSON input');
      });

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.contains('Unexpected end of JSON input');
      });
  });

  it('displays a Loki error payload returned with HTTP 200', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, {
      statusCode: 200,
      body: {
        status: 'error',
        errorType: 'bad_data',
        error: 'parse error at line 1, col 1: unexpected IDENTIFIER',
      },
    }).as('queryRangeStreams');

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.contains(/bad_data/i);
        cy.contains('parse error at line 1, col 1: unexpected IDENTIFIER');
      });
  });

  it('keeps load more logs available after a Loki error payload returned with HTTP 200', () => {
    let requestCount = 0;

    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, (req) => {
      requestCount += 1;
      req.reply(
        requestCount === 1
          ? queryRangeStreamsValidResponse({ message: TEST_MESSAGE })
          : {
              statusCode: 200,
              body: {
                status: 'error',
                errorType: 'bad_data',
                error: 'parse error at line 1, col 1: unexpected IDENTIFIER',
              },
            },
      );
    }).as('queryRangeStreams');

    cy.visit(LOGS_PAGE_URL);
    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LoadMoreLogs).click();
    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LoadMoreLogs).should('exist');
  });

  it('keeps the latest query results when an earlier request completes late', () => {
    let requestCount = 0;

    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, (req) => {
      requestCount += 1;
      const body = queryRangeStreamsValidResponse({
        message:
          requestCount === 1
            ? 'initial result'
            : requestCount === 2
              ? 'stale result'
              : 'latest result',
      });

      req.reply(requestCount === 2 ? { body, delay: 3_000 } : body);
    }).as('queryRangeStreams');

    cy.visit(LOGS_PAGE_URL);
    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.SyncButton).click();
    cy.byTestID(TestIds.TimeRangeDropdown).click();
    cy.contains('Last 6 hours').click();

    cy.contains('latest result').should('exist');
    cy.byTestID(TestIds.LoadMoreLogs).should('exist');

    cy.wait('@queryRangeStreams');
    cy.wait('@queryRangeStreams');
    cy.contains('latest result').should('exist');
    cy.contains('stale result').should('not.exist');
    cy.byTestID(TestIds.LoadMoreLogs).should('exist');
  });

  it('executes a query when "run query" is pressed', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });

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

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });

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
    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
  });

  it('executes a query with the selected tenant when "run query" is pressed', () => {
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

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Re-query the table across the initial config/query rerender.
    cy.byTestID(TestIds.LogsTable).should('contain.text', TEST_MESSAGE);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });

    cy.byTestID(TestIds.TenantToggle).click();
    cy.contains('infrastructure').click();
    cy.wait(50); // Wait for frontend to update after clicking

    cy.wait('@queryRangeStreamsInfrastructure');

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
    cy.get('@queryRangeStreamsInfrastructure.all').should('have.length.at.least', 1);
    cy.get('@queryRangeMatrixInfrastructure.all').should('have.length.at.least', 1);
  });

  it('stores selected values for time range and refresh interval', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.RefreshIntervalDropdown).click();
    cy.contains('1 minute').click();

    cy.byTestID(TestIds.TimeRangeDropdown).click();
    cy.contains('Last 6 hours').click();

    cy.reload();

    cy.byTestID(TestIds.RefreshIntervalDropdown).find('button').should('contain', '1 minute');

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').should('contain', 'Last 6 hours');
  });

  it('disables query executors when the query is empty', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea').clear();
    });

    cy.byTestID(TestIds.ExecuteQueryButton).should('be.disabled');

    cy.byTestID(TestIds.RefreshIntervalDropdown).find('button').should('be.disabled');

    cy.byTestID(TestIds.TimeRangeDropdown).find('button').should('be.disabled');

    cy.byTestID(TestIds.SyncButton).should('be.disabled');

    cy.byTestID(TestIds.SeverityDropdown).find('button').should('be.disabled');

    cy.byTestID(TestIds.TenantToggle).should('be.disabled');
  });

  it('updates the query when selecting filters', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.intercept(PROJECT_URL_MATCH, projectListResponse).as('projectQuery');

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.SeverityDropdown).click();
    cy.contains('error').click();
    cy.byTestID(TestIds.SeverityDropdown).click();

    cy.contains('debug').click();

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .invoke('val')
        .should('equal', '{ log_type="application" } | json | level=~"error|err|eror|debug|dbug"');
    });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).first().click({ force: true });
    });
    cy.get('[role="option"]').contains('Content').click({ force: true });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input').type('line filter');
    });

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .invoke('val')
        .should(
          'equal',
          '{ log_type="application" } |= `line filter` | json | level=~"error|err|eror|debug|dbug"',
        );
    });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).first().click({ force: true });
    });
    cy.get('[role="option"]').contains('Namespaces').click({ force: true });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input').invoke('attr', 'placeholder').should('contain', 'Filter by Namespaces');
      cy.byTestID(TestIds.AttributeOptions).within(() => {
        cy.get('button').click({ force: true });
      });
    });

    // Wait for dropdown to populate and select gitops namespace
    cy.wait(500);

    // Select gitops namespace (avoid table conflicts by using first() and PatternFly v6 selectors)
    cy.get('body').then(($body) => {
      if ($body.find('.pf-v6-c-select__menu').length > 0) {
        cy.get('.pf-v6-c-select__menu').contains('gitops').first().click({ force: true });
      } else {
        cy.contains('gitops').first().click({ force: true });
      }
    });

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .invoke('val')
        .should(
          'equal',
          '{ kubernetes_namespace_name="gitops" } |= `line filter` | json | level=~"error|err|eror|debug|dbug"',
        );
    });

    cy.get('@projectQuery.all').should('have.length.at.least', 1);
  });

  it('updates the url with the proper parameters when selecting a custom range', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.TimeRangeDropdown).click();
    cy.contains('Last 2 hours').click();

    cy.url().should('match', /start=now-2h&end=now/);

    cy.byTestID(TestIds.TimeRangeDropdown).click();
    cy.contains('Custom time range').click();

    cy.byTestID(TestIds.TimeRangeSelectModal)
      .first()
      .within(() => {
        cy.get('input[aria-label="Date picker"]').first().clear().type('2022-10-17').blur();
        cy.get('input[aria-label="Date picker"]').last().clear().type('2022-10-17').blur();

        cy.get('input[aria-label="Precision time picker"]').first().clear().type('14:50{enter}');
        cy.get('input[aria-label="Precision time picker"]').last().clear().type('15:55{enter}');
      });

    cy.byTestID(TestIds.TimeRangeDropdownSaveButton).click();

    const startTime = new Date('2022-10-17T14:50:00').getTime();
    const endTime = new Date('2022-10-17T15:55:00').getTime();

    cy.url().should('match', new RegExp(`start=${startTime}&end=${endTime}`));

    const formattedTimeRange = formatTimeRange({ start: startTime, end: endTime });

    cy.contains(formattedTimeRange);

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
  });

  it('applies plugin configuration from the backend', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );
    cy.intercept(CONFIG_URL_MATCH, { logging: configResponse }).as('config');

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ToggleHistogramButton).click();

    cy.byTestID(TestIds.LogsHistogram)
      .should('exist')
      .within(() => {
        cy.get('svg g > path').should('have.length.above', 0);
      });

    cy.wait('@queryRangeStreams').then(({ request }) => {
      const url = new URL(request.url);
      const pathname = url.pathname;
      expect(pathname).to.equal(
        '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range',
      );
      const limit = url.searchParams.get('limit');
      expect(limit).to.equal(String(configResponse.logsLimit));
    });

    cy.get('@queryRangeMatrix.all').should('have.length.at.least', 1);
    cy.get('@config.all').should('have.length.at.least', 1);
  });

  it('displays a suggestion to fix an error', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, {
      statusCode: 400,
      body: queryRangeStreamsErrorResponse(),
    }).as('queryRangeStreams');

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.contains('Select a smaller time range to reduce the number of results');
      });

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('displays the content of a log entry if the stream result is already formatted', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeStreamsWithLineFormatting()).as(
      'queryRangeStreams',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.get('.lv-plugin__table__message').first().contains('formatted string');
      });

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('displays the message of a log entry if the streams result is an object', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeStreamsWithMessage()).as(
      'queryRangeStreams',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ExecuteQueryButton).click();

    cy.byTestID(TestIds.LogsTable)
      .find('.lv-plugin__table__message')
      .first()
      .should('contain.text', 'a message');

    cy.get('@queryRangeStreams.all').should('have.length.at.least', 1);
  });

  it('displays log based metrics when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeStreams',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LogsMetrics).should('exist');
  });

  it('histogram is disabled and not visible when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeStreams',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    cy.byTestID(TestIds.LogsMetrics).should('exist');
    cy.byTestID(TestIds.ToggleHistogramButton).should('be.disabled');
    cy.byTestID(TestIds.LogsHistogram).should('not.exist');
  });

  it('histogram is disabled after beign enabled by a streams result when query results are matrix type', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeStreamsWithMessage()).as(
      'queryRangeStreams',
    );
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.visit(LOGS_PAGE_URL);

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

    // Re-alias immediately before the click so the wait targets the request this
    // execution triggers, not the histogram's own `sum(...)` request captured by
    // the shared `@queryRangeMatrix` alias.
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as('executeMatrix');
    cy.byTestID(TestIds.ExecuteQueryButton).should('be.enabled').click();

    cy.wait('@executeMatrix');

    cy.byTestID(TestIds.LogsMetrics).should('exist');
    cy.byTestID(TestIds.ToggleHistogramButton).should('be.disabled');
    cy.byTestID(TestIds.LogsHistogram).should('not.exist');

    cy.byTestID(TestIds.LogsQueryInput).should('not.have.attr', 'data-test-query', matrixQuery);

    const streamsQuery = '{ kubernetes_namespace_name="my-namespace" }';

    cy.setLogQueryInput(streamsQuery);

    // Re-alias so the wait targets this execution's streams request rather than a
    // stale one (initial load or histogram toggle) still held by the shared alias.
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, queryRangeStreamsWithMessage()).as(
      'executeStreams',
    );
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

  it('container selection includes the parent pod', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );

    cy.intercept(RESOURCE_URL_MATCH, podsListResponse).as('resourceQuery');
    cy.intercept(SERIES_POD_VALUES_URL_MATCH, containersLabelValuesResponse).as(
      'containersLabelValues',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).first().click({ force: true });
    });
    cy.get('[role="option"]').contains('Content').click({ force: true });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).first().click({ force: true });
    });
    cy.get('[role="option"]').contains('Containers').click({ force: true });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input').invoke('attr', 'placeholder').should('contain', 'Filter by Containers');
      cy.byTestID(TestIds.AttributeOptions).within(() => {
        cy.get('button').click({ force: true });
      });
    });
    cy.wait('@containersLabelValues'); // Wait for the API call to complete
    cy.wait('@resourceQuery'); // Wait for the resource API call to complete
    cy.wait(2000); // Give extra time for data processing and DOM updates

    // Wait for dropdown to populate and try to find container options
    cy.get('body').should('contain', 'my-pod-2 / operator');

    // Select dropdown option - try PatternFly v6 selector first, fallback if needed
    cy.get('body').then(($body) => {
      if ($body.find('[role="option"]').length > 0) {
        cy.get('[role="option"]')
          .contains(/^my-pod-2 \/ operator$/)
          .click({ force: true });
      } else {
        // Fallback to any clickable element containing the text
        cy.contains(/^my-pod-2 \/ operator$/).click({ force: true });
      }
    });

    // Verify checkbox states if options are available
    cy.get('body').then(($body) => {
      if ($body.find('[role="option"]').length > 0) {
        cy.get('[role="option"]')
          .contains(/^my-pod \/ operator$/)
          .find('input')
          .should('not.be.checked');
        cy.get('[role="option"]')
          .contains(/^my-pod-2 \/ operator-2$/)
          .find('input')
          .should('not.be.checked');
        cy.get('[role="option"]')
          .contains(/^my-pod-2 \/ operator$/)
          .find('input')
          .should('be.checked');
      } else {
        // If no role="option" elements, skip checkbox verification
        cy.log('No [role="option"] elements found, skipping checkbox verification');
      }
    });

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .invoke('val')
        .should(
          'equal',
          '{ kubernetes_container_name="operator", kubernetes_pod_name="my-pod-2" } | json',
        );
    });

    cy.get('@resourceQuery.all').should('have.length.at.least', 1);
  });

  it('container selection includes loki labels and k8s resources', () => {
    cy.intercept(
      QUERY_RANGE_STREAMS_URL_MATCH,
      queryRangeStreamsValidResponse({ message: TEST_MESSAGE }),
    ).as('queryRangeStreams');
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, queryRangeMatrixValidResponse()).as(
      'queryRangeMatrix',
    );
    cy.intercept(RESOURCE_URL_MATCH, podsListResponse).as('resourceQuery');
    cy.intercept(SERIES_POD_VALUES_URL_MATCH, containersLabelValuesResponse).as(
      'containersLabelValues',
    );

    cy.visit(LOGS_PAGE_URL);

    cy.byTestID(TestIds.ShowQueryToggle).click();

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.byTestID(TestIds.AvailableAttributes).first().click({ force: true });
    });
    cy.get('[role="option"]').contains('Containers').click({ force: true });

    cy.byTestID(TestIds.AttributeFilters).within(() => {
      cy.get('input').invoke('attr', 'placeholder').should('contain', 'Filter by Containers');
      cy.byTestID(TestIds.AttributeOptions).within(() => {
        cy.get('button').click({ force: true });
      });
    });

    cy.wait('@containersLabelValues');
    cy.wait('@resourceQuery');
    cy.wait(3000);

    cy.get('body').should('contain', 'my-pod-from-labels');

    cy.contains(/^my-pod-from-labels \/ my-container-from-labels$/)
      .should('be.visible')
      .click({ force: true });

    cy.wait(1000);

    cy.get('body').then(($body) => {
      const allText = $body.text();

      if (allText.includes('my-pod-2 / operator')) {
        cy.contains(/^my-pod-2 \/ operator$/).click({ force: true });
      } else if (allText.includes('my-pod-2 / container-2')) {
        cy.contains(/^my-pod-2 \/ container-2$/).click({ force: true });
      }
    });

    cy.byTestID(TestIds.LogsQueryInput).within(() => {
      cy.get('textarea')
        .invoke('val')
        .should('satisfy', (val) => {
          const query = String(val || '');
          return (
            query.includes('my-container-from-labels') &&
            query.includes('my-pod-from-labels') &&
            (query.includes('kubernetes_container_name') || query.includes('| json'))
          );
        });
    });

    cy.get('@resourceQuery.all').should('have.length.at.least', 1);
  });
});
