/**
 * LEGACY ENDPOINT MOCKING LOGIC - NOT CURRENTLY USED
 * 
 * This file contains mocking implementations for the /rules and /silences endpoints
 * that were used by earlier versions of the Incidents UI implementation.
 * 
 * CONTEXT:
 * Earlier versions of the Incidents page fetched silence information from:
 * - /api/prometheus/api/v1/rules - for alerting rules
 * - /api/alertmanager/api/v2/silences - for active silences
 * 
 * The current implementation gets all silence data directly from the /query endpoint
 * via the 'silenced' label in the cluster_health_components_map metric.
 * See: web/src/components/Incidents/processIncidents.ts (line 213)
 * 
 * KEPT FOR FUTURE REFERENCE:
 * This code is preserved in case:
 * 1. We need to switch back to using dedicated endpoints for silences
 * 2. Other parts of the monitoring plugin need these mocks
 * 3. Documentation purposes to understand the full API surface
 * 
 * NOTE: The general alerting/rules pages (not Incidents) still use these endpoints
 * in production. Only the Incidents page has moved away from them.
 * 
 * TO RE-ENABLE: 
 * 1. Uncomment the functions below
 * 2. Export them from this file
 * 3. Import and use them in prometheus-mocks.ts
 */

import { IncidentDefinition, AlertDefinition } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/*
export const SILENCES_ENDPOINTS = [
  '/api/alertmanager/api/v2/silences*',
  '/api/alertmanager-tenancy/api/v2/silences*',
  '/api/proxy/plugin/monitoring-console-plugin/alertmanager-proxy/api/v2/silences*',
];

export const RULES_ENDPOINT = '/api/prometheus/api/v1/rules*';
*/

// ============================================================================
// SILENCE MOCKING
// ============================================================================

/**
 * Generates a pseudo-random UUID for silence IDs
 */
/*
function pseudoUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
*/

/**
 * Generates a silence object for a silenced alert
 * Follows the Alertmanager API v2 silence format
 */
/*
function generateSilenceForAlert(alert: AlertDefinition) {
  const now = Date.now();
  const startsAt = new Date(now - 5 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 5 * 60 * 60 * 1000).toISOString();

  return {
    id: pseudoUUID(),
    status: { state: 'active' },
    updatedAt: new Date(now).toISOString(),
    comment: 'Cypress mock silence',
    createdBy: 'cypress',
    endsAt,
    matchers: [
      { isEqual: true, isRegex: false, name: 'alertname', value: alert.name },
      { isEqual: true, isRegex: false, name: 'severity', value: alert.severity },
      { isEqual: true, isRegex: false, name: 'namespace', value: alert.namespace },
    ],
    startsAt,
  };
}
*/

/**
 * Creates mock silences for all alerts marked as silenced in incident definitions
 * Returns array of Alertmanager API v2 silence objects
 */
/*
export function createSilencesMock(incidents: IncidentDefinition[]) {
  const silences: any[] = [];
  
  incidents.forEach((incident) => {
    incident.alerts
      .filter((alert) => alert.silenced === true)
      .forEach((alert) => {
        silences.push(generateSilenceForAlert(alert));
      });
  });
  
  return silences;
}
*/

/**
 * Sets up Cypress intercepts for all silence endpoint patterns
 * Used to mock Alertmanager silence API responses
 */
/*
export function setupSilencesIntercept(incidents: IncidentDefinition[]) {
  console.log('Setting up silences intercepts for patterns:', SILENCES_ENDPOINTS);
  SILENCES_ENDPOINTS.forEach((endpoint, index) => {
    cy.intercept('GET', endpoint, (req) => {
      const silences = createSilencesMock(incidents);
      console.log(`✓ INTERCEPTED SILENCES (pattern ${index + 1}): ${req.method} ${req.url}`);
      console.log(`  Responding with ${silences.length} silences`);
      if (silences.length > 0) {
        console.log('  Silences sample:', JSON.stringify(silences[0], null, 2));
      }
      req.reply(silences);
    }).as(`silences-${index}`);
  });
}
*/

// ============================================================================
// RULES MOCKING
// ============================================================================

/**
 * Creates mock rules endpoint response that aligns with current incidents
 * This allows silences to be applied to matching alerts/rules
 * 
 * CRITICAL: Each rule MUST have a 'state' field for applySilences() to work correctly
 * The state will be updated to 'silenced' by applySilences() when all alerts are silenced
 */
/*
export function createRulesMock(incidents: IncidentDefinition[]) {
  const now = new Date().toISOString();

  const rules = incidents.flatMap((incident) =>
    incident.alerts.map((alert) => ({
      state: 'firing',
      name: alert.name,
      query: `max_over_time(vector(1)[5m]) >= 1`,
      duration: 0,
      labels: {
        severity: alert.severity,
        namespace: alert.namespace,
        prometheus: 'openshift-monitoring/k8s',
      },
      annotations: {
        description: `Alert ${alert.name} is firing in ${alert.namespace}`,
        summary: `${alert.name} firing`,
      },
      alerts: [
        {
          labels: {
            alertname: alert.name,
            namespace: alert.namespace,
            severity: alert.severity,
            prometheus: 'openshift-monitoring/k8s',
          },
          annotations: {
            description: `Alert ${alert.name} is firing in ${alert.namespace}`,
            summary: `${alert.name} firing`,
          },
          state: 'firing',
          activeAt: now,
          value: '1',
        },
      ],
      health: 'ok',
      type: 'alerting',
    })),
  );

  return {
    status: 'success',
    data: {
      groups: [
        {
          name: 'cypress-mocked-alerts',
          file: '/etc/prometheus/rules/prometheus-k8s-rulefiles-0/cypress-mock-rules.yaml',
          interval: 30,
          rules,
        },
      ],
    },
  };
}
*/

/**
 * Sets up Cypress intercept for the rules endpoint
 * Used to mock Prometheus rules API responses
 */
/*
export function setupRulesIntercept(incidents: IncidentDefinition[]) {
  cy.intercept('GET', RULES_ENDPOINT, (req) => {
    const response = createRulesMock(incidents);
    console.log(`INTERCEPTED RULES: ${req.method} ${req.url}`);
    console.log(`Responding with ${response?.data?.groups?.[0]?.rules?.length ?? 0} rules`);
    console.log('Rules sample:', JSON.stringify(response.data.groups[0].rules.slice(0, 2), null, 2));
    req.reply(response);
  });
}
*/

