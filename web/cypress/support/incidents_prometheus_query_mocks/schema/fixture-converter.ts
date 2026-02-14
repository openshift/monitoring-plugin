import { IncidentDefinition, IncidentTimeline, IncidentScenarioFixture, IncidentFixture } from '../types';
import { parseDuration, nowInClusterTimezone } from '../utils';
import { validateAndParseYamlFixture } from './schema-validator';

/**
 * Converts fixture timeline to runtime timeline with actual timestamps
 */
function convertTimeline(fixtureTimeline: IncidentFixture['timeline'], now: number): IncidentTimeline | undefined {
  if (!fixtureTimeline) return undefined;
  
  const timeline: IncidentTimeline = {
    start: now - parseDuration(fixtureTimeline.start)
  };
  
  if (fixtureTimeline.end) {
    timeline.end = now - parseDuration(fixtureTimeline.end);
  }
  
  if (fixtureTimeline.severityChanges) {
    timeline.severityChanges = fixtureTimeline.severityChanges.map(change => ({
      timestamp: now - parseDuration(change.time),
      severity: change.severity
    }));
  }
  
  return timeline;
}

/**
 * Converts fixture format to runtime incident definitions
 */
export function convertFixtureToIncidents(fixture: IncidentScenarioFixture): IncidentDefinition[] {
  const now = nowInClusterTimezone();
  
  return fixture.incidents.map(incident => ({
    id: incident.id,
    component: incident.component,
    layer: incident.layer,
    timeline: convertTimeline(incident.timeline, now),
    alerts: incident.alerts.map(alert => ({
      name: alert.name,
      namespace: alert.namespace,
      severity: alert.severity,
      component: alert.component,
      firing: alert.firing,
      silenced: alert.silenced === true,
      timeline: convertTimeline(alert.timeline, now)
    })),
    managed_cluster: incident.managed_cluster
  }));
}

/**
 * Converts YAML content to fixture format with schema validation
 */
export function parseYamlFixture(yamlContent: string): IncidentScenarioFixture {
  const result = validateAndParseYamlFixture(yamlContent);
  
  if (!result.valid) {
    const errorMessage = result.errors?.join('\n') || 'Unknown validation error';
    throw new Error(`YAML fixture validation failed:\n${errorMessage}`);
  }
  
  return result.fixture!;
}