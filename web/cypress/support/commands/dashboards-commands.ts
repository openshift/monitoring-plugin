import { DataTestIDs, LegacyTestIDs } from '../../../src/components/data-test';

export { };

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

export const dashboardsUtils = {
  setupMonitoringUIPlugin(MCP: { namespace: string }): void {
    cy.log('Create Monitoring UI Plugin instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/monitoring-ui-plugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=monitoring -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Monitoring plugin pod is now running in namespace: ${MCP.namespace}`);
    });
  },

  setupDashboardsAndPlugins(MCP: { namespace: string }): void {
    cy.log('Create perses-dev namespace.');
    cy.exec(`oc new-project perses-dev --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    /**
     * TODO: When COO1.4.0 is released, points COO_UI_INSTALL to install dashboards on COO1.4.0 folder
     */
    if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. Installing dashboards on COO1.2.0 folder');

      cy.log('Create openshift-cluster-sample-dashboard instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo121_perses/dashboards/openshift-cluster-sample-dashboard.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create perses-dashboard-sample instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo121_perses/dashboards/perses-dashboard-sample.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create prometheus-overview-variables instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo121_perses/dashboards/prometheus-overview-variables.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create thanos-compact-overview-1var instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo121_perses/dashboards/thanos-compact-overview-1var.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create Thanos Querier instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo121_perses/dashboards/thanos-querier-datasource.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    } else {
      cy.log('COO_UI_INSTALL is not set. Installing dashboards on COO1.4.0 folder');

      cy.log('Create openshift-cluster-sample-dashboard instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo141_perses/dashboards/openshift-cluster-sample-dashboard.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create perses-dashboard-sample instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo141_perses/dashboards/perses-dashboard-sample.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create prometheus-overview-variables instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo141_perses/dashboards/prometheus-overview-variables.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create thanos-compact-overview-1var instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-compact-overview-1var.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Create Thanos Querier instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-querier-datasource.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    }

    cy.exec(
      `oc label namespace ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );

    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=perses -n ${MCP.namespace} --timeout=600s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: installTimeoutMilliseconds,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Perses-0 pod is now running in namespace: ${MCP.namespace}`);
    });

    cy.exec(
      `sleep 15 && oc wait --for=jsonpath='{.metadata.name}'=health-analyzer --timeout=60s servicemonitor/health-analyzer -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Health-analyzer service monitor is now running in namespace: ${MCP.namespace}`);
    });

    cy.reload(true);
    cy.visit('/monitoring/v2/dashboards');
    cy.url().should('include', '/monitoring/v2/dashboards');
  },

  setupTroubleshootingPanel(MCP: { namespace: string }): void {
    cy.log('Create troubleshooting panel instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/troubleshooting-panel-ui-plugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Troubleshooting panel instance created. Waiting for pods to be ready.');
    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=troubleshooting-panel -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Troubleshooting panel pod is now running in namespace: ${MCP.namespace}`);
    });

    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=korrel8r -n ${MCP.namespace} --timeout=600s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: installTimeoutMilliseconds,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Korrel8r pod is now running in namespace: ${MCP.namespace}`);
    });

    cy.log('Reloading the page');
    cy.reload(true);
    cy.log('Waiting for 10 seconds before clicking the application launcher');
    cy.wait(10000);
    cy.log('Clicking the application launcher');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
    cy.byTestID(DataTestIDs.MastHeadApplicationItem).contains('Signal Correlation').should('be.visible');
  },

  cleanupTroubleshootingPanel(MCP: { namespace: string; config1?: { kind: string; name: string } }): void {
    const config1 = MCP.config1 || { kind: 'UIPlugin', name: 'troubleshooting-panel' };

    if (Cypress.env('SKIP_ALL_INSTALL')) {
      cy.log('SKIP_ALL_INSTALL is set. Skipping Troubleshooting Panel instance deletion.');
      return;
    }

    cy.log('Delete Troubleshooting Panel instance.');
    cy.executeAndDelete(
      `oc delete ${config1.kind} ${config1.name} --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );
  },

  cleanupDashboards(): void {
    if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo121_perses/dashboards/openshift-cluster-sample-dashboard.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo121_perses/dashboards/perses-dashboard-sample.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo121_perses/dashboards/prometheus-overview-variables.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove thanos-compact-overview-1var instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo121_perses/dashboards/thanos-compact-overview-1var.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo121_perses/dashboards/thanos-querier-datasource.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    } else {
      cy.log('COO_UI_INSTALL is not set. Removing dashboards on COO1.4.0 folder');

      cy.log('Remove openshift-cluster-sample-dashboard instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo141_perses/dashboards/openshift-cluster-sample-dashboard.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove perses-dashboard-sample instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo141_perses/dashboards/perses-dashboard-sample.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove prometheus-overview-variables instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo141_perses/dashboards/prometheus-overview-variables.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove thanos-compact-overview-1var instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-compact-overview-1var.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove Thanos Querier instance.');
      cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-querier-datasource.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    }

    cy.log('Remove perses-dev namespace');
    cy.executeAndDelete(`oc delete namespace perses-dev --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  },
};
