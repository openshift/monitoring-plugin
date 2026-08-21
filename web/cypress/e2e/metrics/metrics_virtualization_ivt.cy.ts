import { runAllRegressionMetricsTests2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionMetricsTests1 } from '../../support/monitoring/02.reg_metrics_1.cy';
import { runAllRegressionMetricsTestsNamespace1 } from '../../support/monitoring/05.reg_metrics_namespace_1.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';
import { runAllRegressionMetricsTestsNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
} from '../../support/operators';

describe(
  'Regression: Monitoring - Metrics (Virtualization)',
  { tags: ['@metrics', '@slow', '@virtualization', '@coo'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
      cy.log('Installation: COO and setting up Monitoring Plugin');
      cy.beforeBlockVirtualization(KUBEVIRT_HYPERCONVERGED_OPERATOR);
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization');
      guidedTour.closeKubevirtTour();
    });
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization');
      guidedTour.closeKubevirtTour();
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      alerts.interceptWatchdogAlert();
    });

    runAllRegressionMetricsTests1({
      name: 'Virtualization',
    });
  },
);

describe(
  'Regression: Monitoring - Metrics Namespaced (Virtualization)',
  { tags: ['@metrics', '@slow', '@virtualization', '@coo'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization');
      guidedTour.closeKubevirtTour();
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
      alerts.interceptWatchdogAlert();
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
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
      cy.log('Installation: COO and setting up Monitoring Plugin');
      cy.beforeBlockVirtualization(KUBEVIRT_HYPERCONVERGED_OPERATOR);
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
    });
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
  { tags: ['@metrics', '@slow', '@virtualization'] },
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
