import 'cypress-wait-until';
import { DataTestIDs, LegacyTestIDs } from '../../../src/components/data-test';
import { waitForPodsReady, waitForResourceCondition } from './wait-utils';

export {};

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

export const dashboardsUtils = {
  setupMonitoringUIPlugin(MCP: { namespace: string }): void {
    cy.log('Create Monitoring UI Plugin instance.');
    cy.exec(
      `oc apply -f ./cypress/fixtures/coo/monitoring-ui-plugin.yaml --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
    );
    waitForPodsReady(
      'app.kubernetes.io/instance=monitoring',
      MCP.namespace,
      readyTimeoutMilliseconds,
    );
    cy.log(`Monitoring plugin pod is now running in namespace: ${MCP.namespace}`);
    cy.checkForAlertRecursively();
  },

  setupDashboardsAndPlugins(MCP: { namespace: string }): void {
    cy.log('Create perses-dev namespace.');
    cy.exec(`oc new-project perses-dev --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`, {
      failOnNonZeroExit: false,
    });

    /**
     * TODO: When COO1.4.0 is released, points COO_UI_INSTALL to install dashboards on
     * COO1.4.0 folder
     */
    if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. Installing dashboards on COO1.4.0 folder');

      cy.log('Create openshift-cluster-sample-dashboard instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create perses-dashboard-sample instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `perses-dashboard-sample.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create prometheus-overview-variables instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `prometheus-overview-variables.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create thanos-compact-overview-1var instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-compact-overview-1var.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create Thanos Querier instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-querier-datasource.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
    } else {
      cy.log('COO_UI_INSTALL is not set. Installing dashboards on COO1.4.0 folder');

      cy.log('Create openshift-cluster-sample-dashboard instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create perses-dashboard-sample instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `perses-dashboard-sample.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create prometheus-overview-variables instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `prometheus-overview-variables.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create thanos-compact-overview-1var instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-compact-overview-1var.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Create Thanos Querier instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-querier-datasource.yaml ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
    }

    cy.exec(
      `oc label namespace ${
        MCP.namespace
      } openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
    );

    waitForPodsReady(
      'app.kubernetes.io/instance=perses',
      MCP.namespace,
      installTimeoutMilliseconds,
    );
    cy.log(`Perses-0 pod is now running in namespace: ${MCP.namespace}`);

    waitForResourceCondition(
      'servicemonitor/health-analyzer',
      "jsonpath='{.metadata.name}'=health-analyzer",
      MCP.namespace,
      readyTimeoutMilliseconds,
    );
    cy.log(`Health-analyzer service monitor is now running in namespace: ${MCP.namespace}`);

    cy.reload(true);
    cy.visit('/monitoring/v2/dashboards');
    cy.url().should('include', '/monitoring/v2/dashboards');
  },

  setupTroubleshootingPanel(MCP: { namespace: string }): void {
    cy.log('Create troubleshooting panel instance.');
    cy.exec(
      `oc apply -f ./cypress/fixtures/coo/troubleshooting-panel-ui-plugin.yaml ` +
        `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );

    cy.log('Troubleshooting panel instance created. Waiting for pods to be ready.');
    waitForPodsReady(
      'app.kubernetes.io/instance=troubleshooting-panel',
      MCP.namespace,
      readyTimeoutMilliseconds,
    );
    cy.log(`Troubleshooting panel pod is now running in namespace: ${MCP.namespace}`);

    waitForPodsReady(
      'app.kubernetes.io/instance=korrel8r',
      MCP.namespace,
      installTimeoutMilliseconds,
    );
    cy.log(`Korrel8r pod is now running in namespace: ${MCP.namespace}`);
    cy.checkForAlertRecursively();
    cy.reload(true);

    // Dynamic plugins may take time to register after reload.
    // Retry by closing/re-opening the launcher until the item appears.
    cy.waitUntil(
      () =>
        cy
          .byLegacyTestID(LegacyTestIDs.ApplicationLauncher, { timeout: 10000 })
          .should('be.visible')
          .click()
          .then(() =>
            cy
              .get(`[data-test="${DataTestIDs.MastHeadApplicationItem}"]`, { timeout: 5000 })
              .then(($items) => $items.filter(':contains("Signal Correlation")').length > 0)
              .then((found) => {
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

  cleanupTroubleshootingPanel(MCP: {
    namespace: string;
    config1?: { kind: string; name: string };
  }): void {
    const config1 = MCP.config1 || { kind: 'UIPlugin', name: 'troubleshooting-panel' };

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
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `perses-dashboard-sample.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `prometheus-overview-variables.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove thanos-compact-overview-1var instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-compact-overview-1var.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-querier-datasource.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
    } else {
      cy.log('COO_UI_INSTALL is not set. Removing dashboards on COO1.4.0 folder');

      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `perses-dashboard-sample.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `prometheus-overview-variables.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove thanos-compact-overview-1var instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-compact-overview-1var.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-querier-datasource.yaml ` +
          `--ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
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
