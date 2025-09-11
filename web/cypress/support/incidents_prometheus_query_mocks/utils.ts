// Utility functions for Prometheus mocking system

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
 * Gets timezone offset in seconds using JavaScript's built-in timezone handling
 * Uses Cypress environment variable CYPRESS_TIMEZONE if no timezone is provided
 */
export function getTimezoneOffset(timezone?: string): number {
  // Use environment variable if no timezone provided
  const effectiveTimezone = timezone || Cypress.env('TIMEZONE') || 'UTC';
  
  try {
    // Use a reference date to get the timezone offset
    const referenceDate = new Date('2024-06-15T12:00:00Z'); // Summer date to handle DST
    
    // Create a date formatter for the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      timeZoneName: 'longOffset'
    });
    
    // Get the timezone offset by comparing UTC and local time
    const utcTime = referenceDate.getTime();
    const localTime = new Date(referenceDate.toLocaleString('en-US', { timeZone: effectiveTimezone })).getTime();
    
    // Calculate offset in seconds
    const offsetMs = localTime - utcTime;
    return Math.floor(offsetMs / 1000);
  } catch (error) {
    console.warn(`Invalid timezone: ${effectiveTimezone}, defaulting to UTC`);
    return 0;
  }
}

/**
 * Converts a UTC timestamp to a timezone-adjusted timestamp
 */
export function adjustTimestampForTimezone(timestamp: number, timezone?: string): number {
  if (!timezone) return timestamp;
  
  const offset = getTimezoneOffset(timezone);
  return timestamp + offset;
}
