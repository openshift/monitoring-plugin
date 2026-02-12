// Type definitions for Prometheus mocking system

export interface PrometheusResult {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

export interface PrometheusResponse {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix';
    result: PrometheusResult[];
  };
}

export interface PrometheusInstantResult {
  metric: Record<string, string>;
  value: [number, string];
}

export interface PrometheusInstantResponse {
  status: 'success' | 'error';
  data: {
    resultType: 'vector';
    result: PrometheusInstantResult[];
  };
}

// Declarative interface for defining incidents with alerts
export interface IncidentDefinition {
  id: string; // Used as group_id
  component: string;
  layer: 'core' | 'Others';
  alerts: AlertDefinition[];
  timeline?: IncidentTimeline;
  managed_cluster?: string;
}

export interface AlertDefinition {
  name: string; // src_alertname
  namespace: string; // src_namespace  
  severity: 'critical' | 'warning' | 'info';
  component?: string; // Optional: override component for this specific alert
  firing?: boolean; // Optional: override firing state (default: true for critical/warning, false for resolved incidents)
  silenced?: boolean; // Optional: mark alert as silenced for testing
  timeline?: IncidentTimeline; // Individual alert timeline
}

export interface IncidentTimeline {
  start: number; // timestamp when incident started
  end?: number; // timestamp when incident ended (omit for ongoing)
  severityChanges?: Array<{
    timestamp: number;
    severity: 'critical' | 'warning' | 'info';
  }>;
}

// YAML fixture interfaces
export interface IncidentScenarioFixture {
  name: string;
  description: string;
  incidents: IncidentFixture[];
}

export interface IncidentFixture {
  id: string;
  component: string;
  layer: 'core' | 'Others';
  timeline?: {
    start: string; // Duration string like "2h", "30m", "7d"
    end?: string; // Duration string
    severityChanges?: Array<{
      time: string; // Duration string
      severity: 'critical' | 'warning' | 'info';
    }>;
  };
  alerts: AlertFixture[];
  managed_cluster?: string;
}

export interface AlertFixture {
  name: string;
  namespace: string;
  severity: 'critical' | 'warning' | 'info';
  component?: string; // Optional: override component for this specific alert
  firing?: boolean;
  silenced?: boolean;
  timeline?: {
    start: string; // Duration string like "2h", "30m", "7d"
    end?: string; // Duration string
    severityChanges?: Array<{
      time: string; // Duration string
      severity: 'critical' | 'warning' | 'info';
    }>;
  };
}
