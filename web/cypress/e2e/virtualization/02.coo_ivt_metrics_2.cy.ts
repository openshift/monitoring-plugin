import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';
import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionMetricsTests2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { runAllRegressionMetricsTestsNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

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

describe(
  'Installation: COO and setting up Monitoring Plugin',
  { tags: ['@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
    });

    it('1. Installation: COO and setting up Monitoring Plugin', () => {
      cy.log('Installation: COO and setting up Monitoring Plugin');
    });
  },
);

describe(
  'IVT: Monitoring UIPlugin + Virtualization',
  { tags: ['@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockVirtualization(KBV);
    });

    it('1. Virtualization perspective - Observe Menu', () => {
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
    });
  },
);

describe(
  'Regression: Monitoring - Metrics (Virtualization)',
  { tags: ['@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      alerts.interceptWatchdogAlert();
    });

    runAllRegressionMetricsTests2({
      name: 'Virtualization',
    });
  },
);

describe(
  'Regression: Monitoring - Metrics Namespaced (Virtualization)',
  { tags: ['@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
      alerts.interceptWatchdogAlert();
    });

    runAllRegressionMetricsTestsNamespace2({
      name: 'Virtualization',
    });
  },
);
