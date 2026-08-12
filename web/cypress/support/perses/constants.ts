export const PERSES_TEST_DASHBOARD_NAME_PREFIXES = [
  'Testing Dashboard - UP ',
  'Renamed dashboard ',
  'Duplicate dashboard ',
  'Test Dashboard',
  'Dashboard to test rename',
  'Dashboard to test duplication',
  'DashboardToTestDuplication',
  'Tempo Loki Perses Global Datasources',
];
export const PERSES_TEST_DASHBOARD_NAME_EXACT = [
  'Testing Perses dashboard - YAML',
  'Testing Perses dashboard - JSON',
  'Service Level dashboards / Virtual Machines by Time in Status',
];

export const PERSES_E2E_DASHBOARDS_DIR = './cypress/fixtures/perses/dashboards';
export const PERSES_E2E_DATASOURCES_DIR = './cypress/fixtures/perses/datasources';
export const SED_OCP_NS_TO_OBS_TEST =
  "sed 's/namespace: openshift-cluster-observability-operator/namespace: observ-test/g'";
export const SED_PERSES_DEV_TO_OBS_TEST = "sed 's/namespace: perses-dev/namespace: observ-test/g'";
