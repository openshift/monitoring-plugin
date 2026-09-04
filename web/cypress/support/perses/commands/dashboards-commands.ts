import 'cypress-wait-until';
import { DataTestIDs, LegacyTestIDs } from '@/shared/constants/data-test';
import { waitForPodsReady, waitForResourceCondition } from '../../commands/wait-utils';
import { installTimeoutMilliseconds, readyTimeoutMilliseconds } from '../../timeouts';
import { PERSES_E2E_DASHBOARDS_DIR, PERSES_E2E_DATASOURCES_DIR } from '../constants';

export {};

export const dashboardsUtils = {
  setupMonitoringUIPlugin(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    cy.log('Create Monitoring UI Plugin instance.');
    cy.exec(
      `oc apply -f ` +
        `./cypress/fixtures/shared/cluster-observability-operator/monitoring-ui-plugin.yaml ` +
        `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );
    waitForPodsReady(
      'app.kubernetes.io/instance=monitoring',
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      readyTimeoutMilliseconds,
    );
    cy.log(
      `Monitoring plugin pod is now running in namespace: ` +
        `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
    );
    cy.checkForAlertRecursively();
    cy.dynamicPluginWorkConsoleAround();
  },

  setupDashboardsAndPlugins(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    cy.log('Create perses-dev namespace.');
    cy.exec(`oc new-project perses-dev --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`, {
      failOnNonZeroExit: false,
    });

    cy.log('Create openshift-cluster-sample-dashboard instance.');
    cy.exec(
      `oc apply -f ${PERSES_E2E_DASHBOARDS_DIR}` +
        `openshift-cluster-sample-dashboard.yaml ` +
        `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
    );

    cy.log('Create perses-dashboard-sample instance.');
    cy.exec(
      `oc apply -f ${PERSES_E2E_DASHBOARDS_DIR}` +
        `perses-dashboard-sample.yaml ` +
        `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
    );

    cy.log('Create prometheus-overview-variables instance.');
    cy.exec(
      `oc apply -f ${PERSES_E2E_DASHBOARDS_DIR}` +
        `prometheus-overview-variables.yaml ` +
        `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
    );

    cy.log('Create thanos-compact-overview instance.');
    cy.exec(
      `oc apply -f ${PERSES_E2E_DASHBOARDS_DIR}` +
        `thanos-compact-overview.yaml ` +
        `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
    );

    cy.log('Create Thanos Querier instance.');
    cy.exec(
      `oc apply -f ${PERSES_E2E_DATASOURCES_DIR}` +
        `thanos-querier-datasource.yaml ` +
        `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
    );

    cy.exec(
      `oc label namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
        `openshift.io/cluster-monitoring=true --overwrite=true ` +
        `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
    );

    waitForPodsReady(
      'app.kubernetes.io/instance=perses',
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      installTimeoutMilliseconds,
    );
    cy.log(`Perses-0 pod is now running in namespace: ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);

    waitForResourceCondition(
      'servicemonitor/health-analyzer',
      "jsonpath='{.metadata.name}'=health-analyzer",
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      readyTimeoutMilliseconds,
    );
    cy.log(
      `Health-analyzer service monitor is now running in namespace: ` +
        `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
    );

    cy.reload(true);
    cy.visit('/monitoring/v2/dashboards');
    cy.url().should('include', '/monitoring/v2/dashboards');
  },

  setupTroubleshootingPanel(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    cy.log('Create troubleshooting panel instance.');
    const tp =
      './cypress/fixtures/shared/cluster-observability-operator/troubleshooting-panel-ui-plugin.yaml';
    cy.exec(`oc apply -f ${tp} --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`);

    cy.log('Troubleshooting panel instance created. Waiting for pods to be ready.');
    waitForPodsReady(
      'app.kubernetes.io/instance=troubleshooting-panel',
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      readyTimeoutMilliseconds,
    );
    cy.log(
      `Troubleshooting panel pod is now running in namespace: ` +
        `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
    );

    waitForPodsReady(
      'app.kubernetes.io/instance=korrel8r',
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      installTimeoutMilliseconds,
    );
    cy.log(`Korrel8r pod is now running in namespace: ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);
    cy.checkForAlertRecursively();
    cy.dynamicPluginWorkConsoleAround();
    cy.reload(true);
    cy.closeOnboardingModalIfPresent();

    // Dynamic plugins may take time to register after reload.
    // Retry by closing/re-opening the launcher until the item appears.
    // Note: the "found" check below must never throw (e.g. via a plain
    // `cy.get(selector)`, which asserts existence and fails hard on a miss) -
    // cy.waitUntil() only retries on a falsy return value, not on thrown
    // command failures, so a throwing check would bypass this retry loop
    // entirely and fail the test on the very first miss.
    cy.waitUntil(
      () =>
        cy
          .byLegacyTestID(LegacyTestIDs.ApplicationLauncher, { timeout: 10000 })
          .should('be.visible')
          .click()
          .then(() =>
            cy.get('body').then(($body) => {
              const found =
                $body
                  .find(`[data-test="${DataTestIDs.MastHeadApplicationItem}"]`)
                  .filter(':contains("Signal correlation")').length > 0;
              if (!found) {
                cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).click();
              }
              return found;
            }),
          ),
      {
        timeout: 60000,
        interval: 5000,
        errorMsg: 'Signal Correlation not found in application launcher after 60s',
      },
    );
  },

  cleanupTroubleshootingPanel(CLUSTER_OBSERVABILITY_OPERATOR: {
    namespace: string;
    config1?: { kind: string; name: string };
  }): void {
    const config1 = CLUSTER_OBSERVABILITY_OPERATOR.config1 || {
      kind: 'UIPlugin',
      name: 'troubleshooting-panel',
    };

    if (Cypress.env('SKIP_ALL_INSTALL')) {
      cy.log('SKIP_ALL_INSTALL is set. Skipping Troubleshooting Panel instance deletion.');
      return;
    }

    cy.log('Delete Troubleshooting Panel instance.');
    cy.executeAndDelete(
      `oc delete ${config1.kind} ${config1.name} --ignore-not-found --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
    );
  },

  cleanupDashboards(): void {
    if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `perses-dashboard-sample.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `prometheus-overview-variables.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove thanos-compact-overview instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `thanos-compact-overview.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DATASOURCES_DIR}` +
          `thanos-querier-datasource.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );
    } else {
      cy.log('COO_UI_INSTALL is not set. Removing dashboards on COO1.4.0 folder');

      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `perses-dashboard-sample.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `prometheus-overview-variables.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove thanos-compact-overview instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DASHBOARDS_DIR}` +
          `thanos-compact-overview.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(
        `oc delete -f ${PERSES_E2E_DATASOURCES_DIR}` +
          `thanos-querier-datasource.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );
    }

    cy.log('Remove perses-dev namespace');
    cy.executeAndDelete(
      `oc delete namespace perses-dev --ignore-not-found --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
    );
  },
};
