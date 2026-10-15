import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { alerts } from '../../fixtures/monitoring/alert';
import { testMetricsRegression2 } from '../../support/monitoring/reg_metrics_2.cy';
import { testMetricsRegressionNamespace2 } from '../../support/monitoring/reg_metrics_namespace_2.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

describe(
  'Regression: Monitoring - Metrics (Virtualization)',
  { tags: ['@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.ensureVirtualization();
    });

    beforeEach(() => {
      cy.restoreLogin();
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

    testMetricsRegression2(CustomerPerspectiveName.Virtualization);
  },
);

describe(
  'Regression: Monitoring - Metrics Namespaced (Virtualization)',
  { tags: ['@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.restoreLogin();
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

    testMetricsRegressionNamespace2(CustomerPerspectiveName.Virtualization);
  },
);
