import { TempoInstance } from './useTempoInstance';

export const BACKEND_URL = '/api/proxy/plugin/distributed-tracing-console-plugin/backend';

export interface APIResponse<T> {
  status: 'success' | 'error';
  errorType?: string;
  error?: string;
  data?: T;
}

export function getProxyURLFor(tempo: TempoInstance) {
  return `${BACKEND_URL}/proxy/${encodeURIComponent(tempo.namespace)}/${encodeURIComponent(
    tempo.name,
  )}/${encodeURIComponent(tempo.tenant ?? 'single-tenant')}`;
}
