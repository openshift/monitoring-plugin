import 'cypress-wait-until';
import { waitForPodsReady, waitForResourceCondition } from './wait-utils';
import { installTimeoutMilliseconds, readyTimeoutMilliseconds } from '../timeouts';
import { CLUSTER_OBSERVABILITY_OPERATOR } from '../operators';

export {};

export const dashboardsUtils = {
  setupMonitoringUIPlugin(): void {
    cy.log('Create Monitoring UI Plugin instance.');
    cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/monitoring-ui-plugin.yaml`);
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

  setupDashboardsAndPlugins(): void {
    cy.log('Create perses-dev namespace.');
    cy.adminCLI(`oc new-project perses-dev`, {
      failOnNonZeroExit: false,
    });

    cy.log('Create openshift-cluster-sample-dashboard instance.');
    cy.adminCLI(
      `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
        `openshift-cluster-sample-dashboard.yaml`,
    );

    cy.log('Create perses-dashboard-sample instance.');
    cy.adminCLI(
      `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
        `perses-dashboard-sample.yaml`,
    );

    cy.log('Create prometheus-overview-variables instance.');
    cy.adminCLI(
      `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
        `prometheus-overview-variables.yaml`,
    );

    cy.log('Create thanos-compact-overview-1var instance.');
    cy.adminCLI(
      `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
        `thanos-compact-overview-1var.yaml`,
    );

    cy.log('Create Thanos Querier instance.');
    cy.adminCLI(
      `oc apply -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
        `thanos-querier-datasource.yaml`,
    );

    cy.adminCLI(
      `oc label namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
        `openshift.io/cluster-monitoring=true --overwrite=true`,
    );

    waitForPodsReady(
      'app.kubernetes.io/instance=perses',
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      installTimeoutMilliseconds,
    );
    cy.log(`Perses-0 pod is now running in namespace: ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);

    cy.reload(true);
    cy.visit('/monitoring/v2/dashboards');
    cy.url().should('include', '/monitoring/v2/dashboards');
  },

  cleanupDashboards(): void {
    if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `perses-dashboard-sample.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `prometheus-overview-variables.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove thanos-compact-overview-1var instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-compact-overview-1var.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-querier-datasource.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );
    } else {
      cy.log('COO_UI_INSTALL is not set. Removing dashboards on COO1.4.0 folder');

      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `openshift-cluster-sample-dashboard.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `perses-dashboard-sample.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `prometheus-overview-variables.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove thanos-compact-overview-1var instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
          `thanos-compact-overview-1var.yaml ` +
          `--ignore-not-found --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      );

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(
        `oc delete -f ./cypress/fixtures/coo/coo140_perses/dashboards/` +
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
