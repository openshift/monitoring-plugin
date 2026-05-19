// Mock data generators for Prometheus mocking system
import { IncidentDefinition, PrometheusResult, AlertDefinition } from './types';
import { severityToValue, parseQueryLabels } from './utils';
import { nowInClusterTimezone } from './utils';
import { NEW_METRIC_NAME, OLD_METRIC_NAME } from './prometheus-mocks';

/**
 * Generates appropriate timestamps between start and end time
 * For short durations (< 5 minutes), generates minimal points
 * For longer durations, uses 5-minute intervals
 */
function generateIntervalTimestamps(startTime: number, endTime: number): number[] {
  const duration = endTime - startTime;
  const fiveMinutes = 300;
  const timestamps: number[] = [];
  
    if (duration < fiveMinutes) {
    timestamps.push(startTime);
    return timestamps;
  }
  
  let currentTime = startTime;
  while (currentTime <= endTime) {
    timestamps.push(currentTime);
    currentTime += fiveMinutes;
  }
  
  // Ensure we have the end timestamp if it doesn't align with 5-minute intervals
  if (timestamps[timestamps.length - 1] !== endTime) {
    timestamps.push(endTime);
  }
  
  return timestamps;
}

/**
 * Gets the severity value for a given timestamp based on severity changes
 */
function getSeverityAtTime(
  timestamp: number,
  severityChanges: Array<{ timestamp: number; severity: 'critical' | 'warning' | 'info' }>,
  defaultSeverity: 'critical' | 'warning' | 'info'
): 'critical' | 'warning' | 'info' {
  // Find the most recent severity change before or at this timestamp
  const applicableChange = severityChanges
    .filter(change => change.timestamp <= timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  return applicableChange ? applicableChange.severity : defaultSeverity;
}

/**
 * Converts severity to metric value based on metric type
 */
function severityToMetricValue(
  severity: 'critical' | 'warning' | 'info',
  alertSeverity: 'critical' | 'warning' | 'info',
  metricType: 'health' | 'alerts'
): string {
  if (metricType === 'alerts') {
    return severity === alertSeverity ? '1' : '0';
  }
  return severityToValue(severity);
}

/**
 * Builds timeline values for both health and alerts metrics
 */
function buildTimelineValues(
  timeline: any,
  alertSeverity: 'critical' | 'warning' | 'info',
  metricType: 'health' | 'alerts',
  queryStartTime?: number,
  queryEndTime?: number
): Array<[number, string]> {
  const now = nowInClusterTimezone();
  const isOngoing = !timeline.end;
  let endTime = isOngoing ? now - 60 : timeline.end;
  let startTime = timeline.start;
  
  // Constrain to query window if provided (simulates Prometheus time range filtering)
  if (queryStartTime !== undefined) {
    startTime = Math.max(startTime, queryStartTime);
  }
  if (queryEndTime !== undefined) {
    endTime = Math.min(endTime, queryEndTime);
  }
  
  // Skip if no data in this time window
  if (startTime > endTime) {
    return [];
  }
  
  const timestamps = generateIntervalTimestamps(startTime, endTime);
  
  const values: Array<[number, string]> = [];
  
  if (timeline.severityChanges?.length) {
    // Timeline with severity changes: use 5-minute intervals with dynamic severity
    timestamps.forEach(timestamp => {
      const severity = getSeverityAtTime(timestamp, timeline.severityChanges, alertSeverity);
      const value = severityToMetricValue(severity, alertSeverity, metricType);
      values.push([timestamp, value]);
    });
  } else {
    // Simple timeline: constant severity throughout
    const value = severityToMetricValue(alertSeverity, alertSeverity, metricType);
    timestamps.forEach(timestamp => {
      values.push([timestamp, value]);
    });
  }

  return values;
}

/**
 * Creates mock incident data from declarative definitions
 */
export function createIncidentMock(
  incidents: IncidentDefinition[], 
  query?: string,
  queryStartTime?: number,
  queryEndTime?: number
): PrometheusResult[] {
  const now = nowInClusterTimezone();
  const results: PrometheusResult[] = [];
  
  // Parse query to extract label selectors if provided
  const queryLabels = query ? parseQueryLabels(query) : {};

  const versioned_metric = query?.includes(NEW_METRIC_NAME) ? NEW_METRIC_NAME : OLD_METRIC_NAME;

  incidents.forEach(incident => {
    // Filter incidents based on query parameters
    if (queryLabels.group_id) {
      const groupIdFilter = queryLabels.group_id;
      const groupIdMatches = Array.isArray(groupIdFilter) 
        ? groupIdFilter.includes(incident.id)
        : groupIdFilter === incident.id;
      
      if (!groupIdMatches) {
        return; // Skip this incident if it doesn't match the query's group_id(s)
      }
    }
    
    incident.alerts.forEach(alert => {
      const metric: Record<string, string> = {
        __name__: versioned_metric,
        component: alert.component || incident.component,
        layer: incident.layer,
        group_id: incident.id,
        src_alertname: alert.name,
        src_namespace: alert.namespace,
        src_severity: alert.severity,
        silenced: (alert.silenced === true).toString(),
        type: 'alert',
        // Standard Prometheus labels, not relevant to the mock
        container: 'health-analyzer',
        endpoint: 'metrics',
        instance: '10.128.0.134:8443',
        job: 'health-analyzer',
        namespace: Cypress.env('COO_NAMESPACE'),
        pod: 'health-analyzer-55fc4cbbb6-5gjcv',
        prometheus: 'openshift-monitoring/k8s',
        service: 'health-analyzer'
      };

      if (incident.managed_cluster) {
        metric.managed_cluster = incident.managed_cluster;
      }

      // Generate timeline values using unified function
      const timeline = incident.timeline || { start: now - 3600 * 24 * 7 };
      const values = buildTimelineValues(timeline, alert.severity, 'health', queryStartTime, queryEndTime);

      // Skip if no data in query time window
      if (values.length === 0) {
        return;
      }

      console.log(`Adding alert: ${alert.name} from incident: ${incident.id}`);
      console.log(`Results array length before push: ${results.length}`);
      results.push({ metric, values });
      console.log(`Results array length after push: ${results.length}`);
    });
  });

  console.log(`Final results array length: ${results.length}`);
  return results;
}

/**
 * Creates mock ALERTS metric data for alert detail queries
 */
export function createAlertDetailsMock(
  incidents: IncidentDefinition[], 
  query: string,
  queryStartTime?: number,
  queryEndTime?: number
): PrometheusResult[] {
  const now = nowInClusterTimezone();
  const results: PrometheusResult[] = [];
  
  // Parse query to extract label selectors
  const queryLabels = parseQueryLabels(query);
  
  incidents.forEach(incident => {
    incident.alerts.forEach(alert => {
      // Filter alerts based on query parameters
      if (queryLabels.alertname) {
        const alertnameFilter = queryLabels.alertname;
        const alertnameMatches = Array.isArray(alertnameFilter) 
          ? alertnameFilter.includes(alert.name)
          : alertnameFilter === alert.name;
        
        if (!alertnameMatches) {
          return; // Skip this alert if it doesn't match the query's alertname(s)
        }
      }
          
          if (queryLabels.namespace) {
            const namespaceFilter = queryLabels.namespace;
            const namespaceMatches = Array.isArray(namespaceFilter)
              ? namespaceFilter.includes(alert.namespace)
              : namespaceFilter === alert.namespace;

            if (!namespaceMatches) {
              return; // Skip this alert if it doesn't match the query's namespace(s)
            }
          }
            
      // Use individual alert timeline if available, otherwise fall back to incident timeline
      const timeline = alert.timeline || incident.timeline || { start: now - 3600 * 24 * 7 };
      const isFiring = !timeline.end;
      
      const effectiveComponent = alert.component || incident.component;
      const metric: Record<string, string> = {
        __name__: 'ALERTS',
        alertname: alert.name,
        // The only way to see the alert in UI is to have the alertstate as firing
        // Resolved is determined entirely by the values array (last value in 10 minutes from now = resolved)
        alertstate: 'firing',
        silenced: (alert.silenced).toString(),
        component: effectiveComponent,
        layer: incident.layer,
        name: effectiveComponent, // Required by processAlerts
        namespace: alert.namespace,
        severity: alert.severity,
        // Standard ALERTS metric labels
        instance: 'prometheus-k8s-0:9090',
        job: 'prometheus-k8s',
        prometheus: 'openshift-monitoring/k8s'
      };

      if (incident.managed_cluster) {
        metric.managed_cluster = incident.managed_cluster;
      }

      // Generate alert timeline values using unified function
      const values = buildTimelineValues(timeline, alert.severity, 'alerts', queryStartTime, queryEndTime);

      // Skip if no data in query time window
      if (values.length === 0) {
        return;
      }

      console.log(`Adding ALERTS alert: ${alert.name} from incident: ${incident.id}`);
      console.log(`ALERTS Results array length before push: ${results.length}`);
      results.push({ metric, values });
      console.log(`ALERTS Results array length after push: ${results.length}`);
    });
  });

  console.log(`Final ALERTS results array length: ${results.length}`);
  return results;
}