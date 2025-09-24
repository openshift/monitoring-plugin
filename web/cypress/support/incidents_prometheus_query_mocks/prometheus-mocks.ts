import { IncidentDefinition, PrometheusResponse, IncidentScenarioFixture } from './types';
import { createIncidentMock, createAlertDetailsMock } from './mock-generators';
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
const MOCK_QUERY = '/api/prometheus/api/v1/query_range*';

/**
 * Main mocking function - sets up cy.intercept for Prometheus query_range API
 * Intercepts the query_range API and returns the mock data for the incidents
 * @param incidents 
 */
export function mockPrometheusQueryRange(incidents: IncidentDefinition[]): void {
  cy.intercept('GET', MOCK_QUERY, (req) => {
    const url = new URL(req.url, window.location.origin);
    const query = url.searchParams.get('query') || '';

    console.log(`INTERCEPTED: ${req.method} ${req.url}`);
    console.log(`Query: ${query}`);

    let results: any[];

    const versioned_metric = query.includes(NEW_METRIC_NAME) 
      ? NEW_METRIC_NAME: OLD_METRIC_NAME;
    
    if (!(query.includes(versioned_metric) || query.includes('ALERTS{'))) {
      console.log(`Passing through non-mocked query`);
      req.continue();
      return;
    }

    results = query.includes(versioned_metric) ? createIncidentMock(incidents, query) : createAlertDetailsMock(incidents, query);
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
    });
  } else {
    cy.fixture(fixturePath).then((fixture: IncidentScenarioFixture) => {
      const incidents = convertFixtureToIncidents(fixture);
      cy.log(`=== SETTING UP JSON FIXTURE: ${fixture.name} (${incidents.length} incidents) ===`);
      mockPrometheusQueryRange(incidents);
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
  
  cy.intercept('GET', MOCK_QUERY, (req) => {
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