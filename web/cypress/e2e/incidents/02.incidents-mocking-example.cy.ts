/*
Example test demonstrating the Prometheus mocking system for incidents.

This test showcases different mocking approaches:
1. Using fixture files for predefined scenarios
2. Using programmatic incident definitions
3. Demonstrating empty state handling
*/

import { commonPages } from '../../views/common';
import { incidentsPage } from '../../views/incidents-page';
import { IncidentDefinition } from '../../support/incidents_prometheus_query_mocks';

const MCP = {
  namespace: Cypress.env('COO_NAMESPACE'),
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: Cypress.env('COO_NAMESPACE'),
  operatorName: 'Cluster Monitoring Operator',
};

describe('Incidents - Mocking Examples', { tags: ['@demo', '@incidents'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
  });

  it('1. Mock silenced and firing incidents with mixed severity', () => {
    cy.log('Setting up silenced critical and firing warning incidents');
    cy.mockIncidentFixture('incident-scenarios/silenced-and-firing-mixed-severity.yaml');
    
    cy.log('One silenced critical incident (resolved) and one firing warning incident should be visible');
    cy.pause();
  });

  it('2. Mock healthy cluster from fixture', () => {
    cy.log('Setting up healthy cluster scenario from fixture');
    cy.mockIncidentFixture('incident-scenarios/0-healthy-cluster.yaml');
    
    cy.pause();
  });

  it('3. Mock single incident with critical and warning alerts', () => {
    cy.log('Setting up single incident with critical and warning alerts from fixture');
    cy.mockIncidentFixture('incident-scenarios/1-single-incident-firing-critical-and-warning-alerts.yaml');
    cy.log('Single incident with mixed severity alerts should be visible');
    cy.pause();
  });

  it('4. Mock multi-incidents with resolved and firing alerts', () => {
    cy.log('Setting up multi-incidents with resolved and firing alerts from fixture');
    cy.mockIncidentFixture('incident-scenarios/2-multi-incidents-multi-alerts-resolved-and-firing.yaml');
    
    cy.log('Multiple incidents with mixed alert states should be visible');
    cy.pause();
  });

  it('5. Mock multi-severity overlapping incidents', () => {
    cy.log('Setting up multi-severity overlapping incidents from fixture');
    cy.mockIncidentFixture('incident-scenarios/3-multi-severity-overlapping-incidents.yaml');
    
    cy.log('Overlapping incidents with different severity distributions should be visible');
    cy.pause();
  });

  it('6. Mock single incident with escalating severity alerts', () => {
    cy.log('Setting up single incident with escalating severity alerts from fixture');
    cy.mockIncidentFixture('incident-scenarios/5-escalating-severity-incident.yaml');

    cy.log('Single incident with escalating severity alerts should be visible');
    cy.pause();
    
  });

  it('7. Mock empty incident state', () => {
    cy.log('Setting up empty incident state');
    cy.mockIncidents([]);
    
    cy.log('No incidents should be visible - empty state');
    cy.pause();
  });

});