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
 * Parses duration string into seconds.
 * Supports single and composite formats, e.g.: "30m", "2h", "7d", "1h30m", "7d2h30m".
 */
export function parseDuration(duration: string): number {
  const trimmed = (duration || '').trim();
  if (!trimmed) {
    throw new Error('Invalid duration format: empty string');
  }

  // Normalize and validate the entire string first
  const normalized = trimmed.toLowerCase();
  const fullPattern = /^(?:\d+[smhd])+$/;
  if (!fullPattern.test(normalized)) {
    throw new Error(
      `Invalid duration format: ${duration}. Use formats like "30m", "2h", "7d", "1h30m", "7d2h30m"`
    );
  }

  // Match one or more occurrences of <number><unit>, where unit ∈ {s, m, h, d}
  const componentRegex = /(\d+)([smhd])/g;
  let match: RegExpExecArray | null;
  let totalSeconds = 0;
  let matchedAny = false;

  while ((match = componentRegex.exec(normalized)) !== null) {
    matchedAny = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        totalSeconds += value;
        break;
      case 'm':
        totalSeconds += value * 60;
        break;
      case 'h':
        totalSeconds += value * 3600;
        break;
      case 'd':
        totalSeconds += value * 86400;
        break;
      default:
        throw new Error(`Unknown duration unit: ${unit}`);
    }
  }
  

  // Ensure the entire string was valid; reject strings with invalid characters/order
  if (!matchedAny) {
    cy.log(`Invalid duration format: ${duration}. Use formats like "30m", "2h", "7d", "1h30m", "7d2h30m"`);
    throw new Error(
      `Invalid duration format: ${duration}. Use formats like "30m", "2h", "7d", "1h30m", "7d2h30m",
       ${normalized}, ${componentRegex.lastIndex}, ${matchedAny}, ${totalSeconds}`
    );
  }

  return totalSeconds;
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
