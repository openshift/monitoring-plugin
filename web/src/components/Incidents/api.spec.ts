// Setup global.window before importing modules that use it
(global as any).window = {
  SERVER_FLAGS: {
    prometheusBaseURL: '/api/prometheus',
    prometheusTenancyBaseURL: '/api/prometheus-tenancy',
    alertManagerBaseURL: '/api/alertmanager',
  },
};

import { createAlertsQuery, fetchDataForIncidentsAndAlerts } from './api';
import { PrometheusResponse, consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { buildPrometheusUrl } from '../utils';

// Mock the SDK
jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  PrometheusEndpoint: {
    QUERY_RANGE: 'api/v1/query_range',
  },
  consoleFetchJSON: jest.fn(),
}));

// Mock the global utils to avoid window access side effects
jest.mock('../utils', () => ({
  getPrometheusBasePath: jest.fn(),
  buildPrometheusUrl: jest.fn(),
}));

describe('createAlertsQuery', () => {
  it('should create a valid alerts query', () => {
    const alertsQuery = createAlertsQuery([
      {
        src_alertname: 'test',
        src_severity: 'critical',
        src_namespace: 'test',
        src_silenced: 'false',
      },
      {
        src_alertname: 'test2',
        src_severity: 'warning',
        src_namespace: 'test2',
        src_silenced: 'false',
      },
      {
        src_alertname: 'test2',
        src_severity: 'warning',
        src_namespace: 'test2',
        src_silenced: 'true',
      },
    ]);
    expect(alertsQuery).toEqual([
      'ALERTS{alertname="test", severity="critical", namespace="test"} or ALERTS{alertname="test2", severity="warning", namespace="test2"}',
    ]);
  });
  it('should create valid alerts queries array', () => {
    const alertsQuery = createAlertsQuery(
      [
        {
          src_alertname: 'test',
          src_severity: 'critical',
          src_namespace: 'test',
          src_silenced: 'false',
        },
        {
          src_alertname: 'test2',
          src_severity: 'warning',
          src_namespace: 'test2',
          src_silenced: 'false',
        },
        {
          src_alertname: 'test2',
          src_severity: 'warning',
          src_namespace: 'test2',
          src_silenced: 'true',
        },
      ],
      100,
    );
    expect(alertsQuery).toEqual([
      'ALERTS{alertname="test", severity="critical", namespace="test"}',
      'ALERTS{alertname="test2", severity="warning", namespace="test2"}',
    ]);
  });
});

describe('fetchDataForIncidentsAndAlerts', () => {
  it('should fetch data for incidents and alerts', async () => {
    (buildPrometheusUrl as jest.Mock).mockReturnValue('/mock/url');
    const now = Date.now();

    const result1 = {
      metric: {
        alertname: 'test',
        severity: 'critical',
        namespace: 'test',
      },
      values: [
        [now - 1000, '1'],
        [now - 500, '2'],
      ] as [number, string][],
    };

    const result2 = {
      metric: {
        alertname: 'test2',
        severity: 'warning',
        namespace: 'test2',
      },
      values: [
        [now - 2000, '3'],
        [now - 1500, '4'],
      ] as [number, string][],
    };

    const mockPrometheusResponse1: PrometheusResponse = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [result1],
      },
    };

    const mockPrometheusResponse2: PrometheusResponse = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [result2],
      },
    };

    const mockConsoleFetchJSON = consoleFetchJSON as jest.MockedFunction<typeof consoleFetchJSON>;
    mockConsoleFetchJSON
      .mockResolvedValueOnce(mockPrometheusResponse1)
      .mockResolvedValueOnce(mockPrometheusResponse2);

    const range = { endTime: now, duration: 86400000 };
    const customQuery = [
      'ALERTS{alertname="test", severity="critical", namespace="test"}',
      'ALERTS{alertname="test2", severity="warning", namespace="test2"}',
    ];
    const result = await fetchDataForIncidentsAndAlerts(mockConsoleFetchJSON, range, customQuery);
    expect(result).toEqual({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [result1, result2],
      },
    });
    expect(mockConsoleFetchJSON).toHaveBeenCalledTimes(2);
  });
});
