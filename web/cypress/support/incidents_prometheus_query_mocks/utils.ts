// Utility functions for Prometheus mocking system
import { TZDate } from "@date-fns/tz";

/**
 * Converts severity string to numeric value expected by UI
 */
export function severityToValue(severity: 'critical' | 'warning' | 'info'): string {
  switch (severity) {
    case 'critical': return '2';
    case 'warning': return '1';  
    case 'info': return '0';
    default: return '0';
  }
}

/**
 * Parses duration string (e.g., "30m", "2h", "7d") into seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like "30m", "2h", "7d"`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Parses Prometheus query to extract label selectors
 */
export function parseQueryLabels(query: string): Record<string, string | string[]> {
  const labels: Record<string, string | string[]> = {};
  
  // Match label selectors in the format: labelname="value" or labelname='value'
  const regex = /(\w+)=["']([^"']+)["']/g;
  let match;
  
  while ((match = regex.exec(query)) !== null) {
    const [, labelName, labelValue] = match;
    
    if (labels[labelName]) {
      // If we already have a value for this label, convert to array
      if (Array.isArray(labels[labelName])) {
        (labels[labelName] as string[]).push(labelValue);
      } else {
        labels[labelName] = [labels[labelName] as string, labelValue];
      }
    } else {
      labels[labelName] = labelValue;
    }
  }
  
  return labels;
}

/**
 * Gets the current time in the timezone specified by the CYPRESS_TIMEZONE environment variable
 */
export function nowInClusterTimezone(): number {
  const timezone = Cypress.env('TIMEZONE') || 'UTC';
  const now = Math.floor(TZDate.tz(timezone).getTime() / 1000);
  return now;
}
