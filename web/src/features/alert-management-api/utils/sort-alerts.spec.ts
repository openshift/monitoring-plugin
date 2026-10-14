import { AlertSeverity, AlertStates } from '@openshift-console/dynamic-plugin-sdk';

import { AggregatedAlert, ManagedAlert } from '@/features/alert-management-api/types/types';
import { sortAlerts } from '@/features/alert-management-api/utils/sort-alerts';

const row = (
  name: string,
  severity: string,
  scope: string,
  component: string,
  source: string,
  state: AlertStates,
  total: number,
): AggregatedAlert => ({
  key: name,
  name,
  severity,
  alertScope: scope,
  component,
  source,
  state: [state],
  alerts: Array.from({ length: total }, () => ({}) as ManagedAlert),
});

const rows = [
  row('Alpha', AlertSeverity.Warning, 'Namespace', 'storage', 'platform', AlertStates.Pending, 1),
  row('Zulu', AlertSeverity.Critical, 'Cluster', 'api', 'user', AlertStates.Firing, 2),
  row('Bravo', AlertSeverity.Info, 'Cluster', 'db', 'user', AlertStates.Silenced, 3),
];

describe('alert management sort', () => {
  it.each([
    ['name', 'asc', ['Alpha', 'Bravo', 'Zulu']],
    ['severity', 'asc', ['Zulu', 'Alpha', 'Bravo']],
    ['severity', 'desc', ['Bravo', 'Alpha', 'Zulu']],
    ['total', 'desc', ['Bravo', 'Zulu', 'Alpha']],
    ['state', 'asc', ['Zulu', 'Alpha', 'Bravo']],
    ['scope', 'asc', ['Zulu', 'Bravo', 'Alpha']],
    ['component', 'asc', ['Zulu', 'Bravo', 'Alpha']],
    ['source', 'asc', ['Alpha', 'Zulu', 'Bravo']],
  ] as const)('sorts by %s %s', (column, direction, names) => {
    expect(
      sortAlerts(rows, { column, direction }).map((alert) => alert.name),
      `alerts should sort by ${column} ${direction}`,
    ).toEqual(names);
    expect(
      rows.map((alert) => alert.name),
      'sorting should leave the input rows unchanged',
    ).toEqual(['Alpha', 'Zulu', 'Bravo']);
  });

  it('sorts by description text', () => {
    const descriptiveRows = [
      {
        ...rows[0],
        alerts: [{ ...rows[0].alerts[0], annotations: { description: 'Zulu' } }],
      },
      {
        ...rows[1],
        alerts: [{ ...rows[1].alerts[0], annotations: { description: 'Alpha' } }],
      },
      {
        ...rows[2],
        alerts: [{ ...rows[2].alerts[0], annotations: { description: 'Mike' } }],
      },
    ];

    expect(
      sortAlerts(descriptiveRows, { column: 'description', direction: 'asc' }).map(
        (alert) => alert.name,
      ),
      'alerts should sort by description text in ascending order',
    ).toEqual(['Zulu', 'Bravo', 'Alpha']);
  });

  it.each(['namespace', 'resource'] as const)('sorts by %s label', (column) => {
    const labeledRows = rows.map((alert, index) => ({
      ...alert,
      alerts: [
        { ...alert.alerts[0], labels: { alertname: alert.name, [column]: ['z', 'a', 'm'][index] } },
      ],
    }));

    expect(
      sortAlerts(labeledRows, { column, direction: 'asc' }).map((alert) => alert.name),
    ).toEqual(['Zulu', 'Bravo', 'Alpha']);
    expect(
      sortAlerts(labeledRows, { column, direction: 'desc' }).map((alert) => alert.name),
    ).toEqual(['Alpha', 'Bravo', 'Zulu']);
  });

  it('sorts by the earliest firing time in each aggregate', () => {
    const firingRows = [
      { ...rows[0], alerts: [{ activeAt: '2026-01-03T00:00:00Z' } as ManagedAlert] },
      { ...rows[1], alerts: [{ activeAt: '2026-01-01T00:00:00Z' } as ManagedAlert] },
      { ...rows[2], alerts: [{ activeAt: '2026-01-02T00:00:00Z' } as ManagedAlert] },
    ];

    expect(
      sortAlerts(firingRows, { column: 'firingSince', direction: 'asc' }).map(
        (alert) => alert.name,
      ),
      'aggregates should sort by their earliest firing time',
    ).toEqual(['Zulu', 'Bravo', 'Alpha']);
  });

  it('breaks ties using the documented default order', () => {
    const equalNames = [
      row('Same', AlertSeverity.Warning, 'Namespace', 'storage', 'user', AlertStates.Firing, 1),
      row('Same', AlertSeverity.Critical, 'Cluster', 'api', 'platform', AlertStates.Pending, 1),
    ];

    expect(
      sortAlerts(equalNames, { column: 'name', direction: 'desc' }).map((alert) => alert.severity),
      'equal names should use the documented default tie-break order',
    ).toEqual([AlertSeverity.Critical, AlertSeverity.Warning]);
  });
});
