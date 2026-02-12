import { IncidentDefinition, PrometheusResponse, PrometheusInstantResponse, IncidentScenarioFixture } from './types';
import { createIncidentMock, createAlertDetailsMock, createIncidentTimestampMock, createAlertTimestampMock } from './mock-generators';
import { convertFixtureToIncidents, parseYamlFixture } from './schema/fixture-converter';

declare global {
  namespace Cypress {
    interface Chainable {
      mockIncidents(incidents: IncidentDefinition[]): Chainable<Element>;
      mockIncidentFixture(fixturePath: string): Chainable<Element>;
      transformMetrics(): Chainable<Element>;
    }
  }
}

export const NEW_METRIC_NAME = 'cluster_health_components_map';
export const OLD_METRIC_NAME = 'cluster:health:components:map';
const MOCK_QUERY_RANGE = '/api/prometheus/api/v1/query_range*';
const MOCK_QUERY_INSTANT = /\/api\/prometheus\/api\/v1\/query\?.*/;

/**
 * Main mocking function - sets up cy.intercept for Prometheus query_range API
 * 
 * The Incidents page gets all data from the /query endpoint, including silence status
 * via the 'silenced' label in the cluster_health_components_map metric.
 *  * 
 * @param incidents - Array of incident definitions to mock
 */
export function mockPrometheusQueryRange(incidents: IncidentDefinition[]): void {
  cy.intercept('GET', MOCK_QUERY_RANGE, (req) => {
    const url = new URL(req.url, window.location.origin);
    const query = url.searchParams.get('query') || '';
    const startTime = url.searchParams.get('start');
    const endTime = url.searchParams.get('end');

    const queryStartTime = startTime ? parseFloat(startTime) : undefined;
    const queryEndTime = endTime ? parseFloat(endTime) : undefined;

    console.log(`INTERCEPTED: ${req.method} ${req.url}`);
    console.log(`Query: ${query}`);
    console.log(`Time range: ${queryStartTime} - ${queryEndTime}`);

    let results: any[];

    const versioned_metric = query.includes(NEW_METRIC_NAME) 
      ? NEW_METRIC_NAME: OLD_METRIC_NAME;
    
    if (!(query.includes(versioned_metric) || query.includes('ALERTS{'))) {
      console.log(`Passing through non-mocked query`);
      req.continue();
      return;
    }

    results = query.includes(versioned_metric) 
      ? createIncidentMock(incidents, query, queryStartTime, queryEndTime) 
      : createAlertDetailsMock(incidents, query, queryStartTime, queryEndTime);
    const response: PrometheusResponse = {
        status: 'success',
        data: {
          resultType: 'matrix',
          result: results
        }
      };

      console.log(`Responding with ${results.length} incident alerts from ${incidents.length} incidents`);
      req.reply(response);

  });
}

/**
 * Mocks instant queries for min_over_time timestamp lookups
 * Used for absolute start timestamps of incidents and alerts
 */
export function mockPrometheusInstantQuery(incidents: IncidentDefinition[]): void {
  cy.intercept('GET', MOCK_QUERY_INSTANT, (req) => {
    const url = new URL(req.url, window.location.origin);
    const query = url.searchParams.get('query') || '';

    console.log(`INTERCEPTED INSTANT: ${req.method} ${req.url}`);
    console.log(`Query: ${query}`);

    if (query.includes('min_over_time') && query.includes('timestamp')) {
      let results: any[];
      
      if (query.includes(NEW_METRIC_NAME) || query.includes(OLD_METRIC_NAME)) {
        results = createIncidentTimestampMock(incidents);
      } else if (query.includes('ALERTS')) {
        results = createAlertTimestampMock(incidents);
      } else {
        console.log('Passing through non-mocked instant query');
        req.continue();
        return;
      }

      const response: PrometheusInstantResponse = {
        status: 'success',
        data: {
          resultType: 'vector',
          result: results
        }
      };

      console.log(`Responding with ${results.length} timestamp results`);
      req.reply(response);
      return;
    }

    console.log('Passing through non-mocked instant query');
    req.continue();
  });
}

Cypress.Commands.add('mockIncidents', (incidents: IncidentDefinition[]) => {
  cy.log(`=== SETTING UP INCIDENT MOCKING (${incidents.length} incidents) ===`);
  if (!Array.isArray(incidents)) {
    throw new Error('mockIncidents expects an array of IncidentDefinition objects');
  }

  incidents.forEach((incident, index) => {
    if (!incident.id || !incident.component || !incident.layer || !incident.alerts) {
      throw new Error(`Invalid incident at index ${index}: missing required fields
        (id, component, layer, alerts)`);
    }
  });

  cy.log(`=== SETTING UP INCIDENT MOCKING (${incidents.length} incidents) ===`);
  mockPrometheusQueryRange(incidents);
  mockPrometheusInstantQuery(incidents);
  // The mocking is not applied until the page is reloaded and the components fetch the new data
  cy.reload();
});

Cypress.Commands.add('mockIncidentFixture', (fixturePath: string) => {
  if (fixturePath.endsWith('.yaml') || fixturePath.endsWith('.yml')) {
    cy.fixture(fixturePath).then((yamlContent: string) => {
      const fixture = parseYamlFixture(yamlContent);
      const incidents = convertFixtureToIncidents(fixture);
      cy.log(`=== SETTING UP YAML FIXTURE: ${fixture.name} (${incidents.length} incidents) ===`);
      mockPrometheusQueryRange(incidents);
      mockPrometheusInstantQuery(incidents);
    });
  } else {
    cy.fixture(fixturePath).then((fixture: IncidentScenarioFixture) => {
      const incidents = convertFixtureToIncidents(fixture);
      cy.log(`=== SETTING UP JSON FIXTURE: ${fixture.name} (${incidents.length} incidents) ===`);
      mockPrometheusQueryRange(incidents);
      mockPrometheusInstantQuery(incidents);
    });
  }


  // The mocking is not applied until the page is reloaded and the components fetch the new data
  cy.reload();
});

Cypress.Commands.add('transformMetrics', () => {
  cy.log('=== SETTING UP METRIC TRANSFORMATION ===');
  const mockNewMetrics = Cypress.env('MOCK_NEW_METRICS') === true;

  
  if (!mockNewMetrics) {
    cy.log('CYPRESS_MOCK_NEW_METRICS is disabled, skipping transformation');
    return;
  }

  cy.log('Transforming old metric queries to new format');
  
  cy.intercept('GET', MOCK_QUERY_RANGE, (req) => {
    const url = new URL(req.url, window.location.origin);
    const query = url.searchParams.get('query') || '';
    const hasNewMetric = query.includes(NEW_METRIC_NAME);
    
    if (hasNewMetric) {
      const transformedQuery = query.replace(new RegExp(NEW_METRIC_NAME, 'g'), OLD_METRIC_NAME);
      console.log(`Transforming metric query: ${query} -> ${transformedQuery}`);
      
      // Update the URL with the transformed query
      url.searchParams.set('query', transformedQuery);
      req.url = url.toString();
      
      // Also transform the response to use new metric names
      req.continue((res) => {
        if (res.body?.data?.result) {
          res.body.data.result.forEach((result: any) => {
            if (result?.metric?.__name__ === OLD_METRIC_NAME) {
              console.log(`Transforming response metric name: ${OLD_METRIC_NAME} -> ${NEW_METRIC_NAME}`);
              result.metric.__name__ = NEW_METRIC_NAME;
            }
          });
        }
        res.send();
      });
    } else {
      req.continue();
    }
  });
});