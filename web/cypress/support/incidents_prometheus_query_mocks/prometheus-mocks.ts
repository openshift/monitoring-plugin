import { IncidentDefinition, PrometheusResponse, IncidentScenarioFixture } from './types';
import { createIncidentMock, createAlertDetailsMock } from './mock-generators';
import { convertFixtureToIncidents, parseYamlFixture } from './schema/fixture-converter';

declare global {
  namespace Cypress {
    interface Chainable {
      mockIncidents(incidents: IncidentDefinition[]): Chainable<Element>;
      mockIncidentFixture(fixturePath: string): Chainable<Element>;
    }
  }
}

/**
 * Main mocking function - sets up cy.intercept for Prometheus query_range API
 * Intercepts the query_range API and returns the mock data for the incidents
 * @param incidents 
 */
export function mockPrometheusQueryRange(incidents: IncidentDefinition[]): void {
  cy.intercept('GET', '/api/prometheus/api/v1/query_range*', (req) => {
    const url = new URL(req.url, window.location.origin);
    const query = url.searchParams.get('query') || '';

    console.log(`INTERCEPTED: ${req.method} ${req.url}`);
    console.log(`Query: ${query}`);

    let results: any[];
    
    if (!(query.includes('cluster:health:components:map') || query.includes('ALERTS{'))) {
      console.log(`Passing through non-mocked query`);
      req.continue();
      return;
    }

    results = query.includes('cluster:health:components:map') ? createIncidentMock(incidents, query) : createAlertDetailsMock(incidents, query);

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