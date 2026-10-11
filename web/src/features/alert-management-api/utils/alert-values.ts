import { ManagedAlert } from '@/features/alert-management-api/types/types';

export const getFiringSinceTimestamp = (alerts: ManagedAlert[]) => {
  const timestamps = alerts.map((alert) => Date.parse(alert.activeAt)).filter(Number.isInteger);
  return timestamps.length > 0 ? Math.min(...timestamps) : 0;
};

export const formatFiringSince = (alerts: ManagedAlert[]) => {
  const timestamp = getFiringSinceTimestamp(alerts);
  return timestamp !== 0 ? new Date(timestamp).toLocaleString() : '';
};
