import { runAllRegressionMetricsTests2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionMetricsTests1 } from '../../support/monitoring/02.reg_metrics_1.cy';
import { runAllRegressionMetricsTestsNamespace1 } from '../../support/monitoring/05.reg_metrics_namespace_1.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';
import { runAllRegressionMetricsTestsNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';

// Set constants for the operators that need to be installed for tests.
const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const KBV = {
  namespace: 'openshift-cnv',
  packageName: 'kubevirt-hyperconverged',
  config: {
    kind: 'HyperConverged',
    name: 'kubevirt-hyperconverged',
  },
  crd: {
    kubevirt: 'kubevirts.kubevirt.io',
    hyperconverged: 'hyperconvergeds.hco.kubevirt.io',
  },
};

describe('Regression: Monitoring - Metrics (Virtualization)', () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP);
    cy.log('Installation: COO and setting up Monitoring Plugin');
    cy.beforeBlockVirtualization(KBV);
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
  });

  describe(
    'Regression: Monitoring - Metrics (Virtualization)',
    { tags: ['@metrics', '@coo', '@slow', '@virtualization'] },
    () => {
      beforeEach(() => {
        cy.visit('/');
        cy.validateLogin();
        cy.switchPerspective('Virtualization');
        guidedTour.closeKubevirtTour();
        alerts.getWatchdogAlert();
        nav.sidenav.clickNavLink(['Observe', 'Metrics']);
        commonPages.titleShouldHaveText('Metrics');
        cy.changeNamespace('All Projects');
        alerts.getWatchdogAlert();
      });

      runAllRegressionMetricsTests1({
        name: 'Virtualization',
      });
    },
  );

  describe(
    'Regression: Monitoring - Metrics Namespaced (Virtualization)',
    { tags: ['@metrics', '@coo', '@slow', '@virtualization'] },
    () => {
      beforeEach(() => {
        cy.visit('/');
        cy.validateLogin();
        cy.switchPerspective('Virtualization');
        guidedTour.closeKubevirtTour();
        alerts.getWatchdogAlert();
        nav.sidenav.clickNavLink(['Observe', 'Metrics']);
        commonPages.titleShouldHaveText('Metrics');
        cy.changeNamespace(MP.namespace);
        alerts.getWatchdogAlert();
      });

      runAllRegressionMetricsTestsNamespace1({
        name: 'Virtualization',
      });
    },
  );

  describe(
    'Regression: Monitoring - Metrics (Virtualization)',
    { tags: ['@metrics', '@slow', '@virtualization'] },
    () => {
      beforeEach(() => {
        cy.visit('/');
        cy.validateLogin();
        cy.switchPerspective('Virtualization', 'Fleet virtualization');
        guidedTour.closeKubevirtTour();
        alerts.getWatchdogAlert();
        nav.sidenav.clickNavLink(['Observe', 'Metrics']);
        commonPages.titleShouldHaveText('Metrics');
        cy.changeNamespace('All Projects');
        alerts.getWatchdogAlert();
      });

      runAllRegressionMetricsTests2({
        name: 'Virtualization',
      });
    },
  );

  describe(
    'Regression: Monitoring - Metrics Namespaced (Virtualization)',
    { tags: ['@metrics', '@slow', '@virtualization'] },
    () => {
      beforeEach(() => {
        cy.visit('/');
        cy.validateLogin();
        cy.switchPerspective('Virtualization', 'Fleet virtualization');
        guidedTour.closeKubevirtTour();
        alerts.getWatchdogAlert();
        nav.sidenav.clickNavLink(['Observe', 'Metrics']);
        commonPages.titleShouldHaveText('Metrics');
        cy.changeNamespace(MP.namespace);
        alerts.getWatchdogAlert();
      });

      runAllRegressionMetricsTestsNamespace2({
        name: 'Virtualization',
      });
    },
  );
});
