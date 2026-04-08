export {};

import { nav } from '../../views/nav';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { listPersesDashboardsOUIAIDs } from '../../../src/components/data-test';

// Display name prefixes/exact matches for test-created PersesDashboards to delete before
// Perses tests.
// Examples: "Test Dashboard0.24...", "Dashboard to test duplication0.33...",
// "Testing Dashboard - UP 0.32..."
const PERSES_TEST_DASHBOARD_NAME_PREFIXES = [
  'Testing Dashboard - UP ',
  'Renamed dashboard ',
  'Duplicate dashboard ',
  'Test Dashboard',
  'Dashboard to test rename',
  'Dashboard to test duplication',
  'DashboardToTestDuplication',
];
const PERSES_TEST_DASHBOARD_NAME_EXACT = [
  'Testing Perses dashboard - YAML',
  'Testing Perses dashboard - JSON',
  'Service Level dashboards / Virtual Machines by Time in Status',
];

const PERSES_E2E_DASHBOARDS_DIR = './cypress/fixtures/coo/coo140_perses/dashboards';
const SED_OCP_NS_TO_OBS_TEST =
  "sed 's/namespace: openshift-cluster-observability-operator/namespace: observ-test/g'";
const SED_PERSES_DEV_TO_OBS_TEST = "sed 's/namespace: perses-dev/namespace: observ-test/g'";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      setupPersesRBACandExtraDashboards(): Chainable<void>;
      cleanupExtraDashboards(): Chainable<void>;
      /** Delete test Perses dashboards via UI (list page). Call before Perses tests. */
      cleanupPersesTestDashboardsBeforeTests(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('setupPersesRBACandExtraDashboards', () => {
  if (
    `${Cypress.env('LOGIN_USERNAME1')}` !== 'kubeadmin' &&
    Cypress.env('LOGIN_USERNAME2') !== undefined
  ) {
    cy.exec('./cypress/fixtures/coo/coo140_perses/rbac/rbac_perses_e2e_ci_users.sh', {
      env: {
        USER1: `${Cypress.env('LOGIN_USERNAME1')}`,
        USER2: `${Cypress.env('LOGIN_USERNAME2')}`,
        USER3: `${Cypress.env('LOGIN_USERNAME3')}`,
        USER4: `${Cypress.env('LOGIN_USERNAME4')}`,
        USER5: `${Cypress.env('LOGIN_USERNAME5')}`,
        USER6: `${Cypress.env('LOGIN_USERNAME6')}`,
      },
    });

    const kc = Cypress.env('KUBECONFIG_PATH');

    cy.log('Create openshift-cluster-sample-dashboard instance.');
    cy.exec(
      `${SED_OCP_NS_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
        `openshift-cluster-sample-dashboard.yaml | oc apply -f - --kubeconfig ${kc}`,
    );

    cy.log('Create perses-dashboard-sample instance.');
    cy.exec(
      `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
        `perses-dashboard-sample.yaml | oc apply -f - --kubeconfig ${kc}`,
    );

    cy.log('Create prometheus-overview-variables instance.');
    cy.exec(
      `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
        `prometheus-overview-variables.yaml | oc apply -f - --kubeconfig ${kc}`,
    );

    cy.log('Create thanos-compact-overview-1var instance.');
    cy.exec(
      `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
        `thanos-compact-overview-1var.yaml | oc apply -f - --kubeconfig ${kc}`,
    );

    cy.log('Create Thanos Querier instance.');
    cy.exec(
      `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
        `thanos-querier-datasource.yaml | oc apply -f - --kubeconfig ${kc}`,
    );
  }
});

Cypress.Commands.add('cleanupExtraDashboards', () => {
  const kc = Cypress.env('KUBECONFIG_PATH');

  cy.log('Remove openshift-cluster-sample-dashboard instance.');
  cy.exec(
    `${SED_OCP_NS_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
      `openshift-cluster-sample-dashboard.yaml | oc delete -f - --ignore-not-found ` +
      `--kubeconfig ${kc}`,
  );

  cy.log('Remove perses-dashboard-sample instance.');
  cy.exec(
    `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
      `perses-dashboard-sample.yaml | oc delete -f - --ignore-not-found ` +
      `--kubeconfig ${kc}`,
  );

  cy.log('Remove prometheus-overview-variables instance.');
  cy.exec(
    `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
      `prometheus-overview-variables.yaml | oc delete -f - --ignore-not-found ` +
      `--kubeconfig ${kc}`,
  );

  cy.log('Remove thanos-compact-overview-1var instance.');
  cy.exec(
    `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
      `thanos-compact-overview-1var.yaml | oc delete -f - --ignore-not-found ` +
      `--kubeconfig ${kc}`,
  );

  cy.log('Remove Thanos Querier instance.');
  cy.exec(
    `${SED_PERSES_DEV_TO_OBS_TEST} ${PERSES_E2E_DASHBOARDS_DIR}/` +
      `thanos-querier-datasource.yaml | oc delete -f - --ignore-not-found ` +
      `--kubeconfig ${kc}`,
  );

  cy.log('Remove observ-test namespace');
  cy.exec(
    `oc delete namespace observ-test --ignore-not-found --kubeconfig ${Cypress.env(
      'KUBECONFIG_PATH',
    )}`,
  );
});

function isTestDashboardName(displayName: string | undefined): boolean {
  if (!displayName) return false;
  if (PERSES_TEST_DASHBOARD_NAME_EXACT.includes(displayName)) return true;
  return PERSES_TEST_DASHBOARD_NAME_PREFIXES.some((p) => displayName.startsWith(p));
}

const MAX_UI_CLEANUP_ITERATIONS = 50;

Cypress.Commands.add('cleanupPersesTestDashboardsBeforeTests', () => {
  cy.log('Perses cleanup: remove test dashboards via UI.');
  nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
  cy.wait(5000);
  cy.changeNamespace('All Projects');
  cy.wait(5000);
  cy.get(`[data-ouia-component-id^="${listPersesDashboardsOUIAIDs.PersesDashListDataViewTable}"]`, {
    timeout: 15000,
  })
    .should('be.visible')
    .then(() => {
      runDeleteOneMatching(0);
    });
});

function runDeleteOneMatching(iteration: number): void {
  if (iteration >= MAX_UI_CLEANUP_ITERATIONS) return;
  cy.get('body').then(($body) => {
    const $table = $body.find(
      `[data-ouia-component-id^="${listPersesDashboardsOUIAIDs.PersesDashListDataViewTable}"]`,
    );
    if ($table.length === 0) return;
    const $rows = $table.find('tbody tr');
    if ($rows.length === 0) return;
    let deleteIndex = -1;
    let deleteName = '';
    for (let i = 0; i < $rows.length; i++) {
      const $row = $rows.eq(i);
      const $link = $row
        .find('a')
        .filter((_, el) => Cypress.$(el).text().trim().length > 0)
        .first();
      const name = $link.length ? $link.text().trim() : '';
      if (name && isTestDashboardName(name)) {
        deleteIndex = i;
        deleteName = name;
        break;
      }
    }
    if (deleteIndex < 0) return;
    cy.log(`Perses cleanup (UI): deleting "${deleteName}" (row ${deleteIndex})`);
    listPersesDashboardsPage.clickKebabIcon(deleteIndex);
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    cy.wait(4000);
    cy.then(() => runDeleteOneMatching(iteration + 1));
  });
}
