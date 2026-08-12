import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testMetricsRegression2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { testMetricsRegression1 } from '../../support/monitoring/02.reg_metrics_1.cy';
import { testMetricsRegressionNamespace1 } from '../../support/monitoring/05.reg_metrics_namespace_1.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';
import { testMetricsRegressionNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
} from '../../support/operators';

describe('Regression: Monitoring - Metrics (Virtualization)', () => {
  before(() => {
    cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
    cy.log('Installation: COO and setting up Monitoring Plugin');
    cy.beforeBlockVirtualization(KUBEVIRT_HYPERCONVERGED_OPERATOR);
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
  });

  describe(
    'Regression: Monitoring - Metrics (Virtualization)',
    { tags: ['@metrics', '@coo', '@virtualization', '@slow'] },
    () => {
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

      testMetricsRegression1(CustomerPerspectiveName.Virtualization);
    },
  );

  describe(
    'Regression: Monitoring - Metrics Namespaced (Virtualization)',
    { tags: ['@metrics', '@coo', '@virtualization', '@slow'] },
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

      testMetricsRegressionNamespace1(CustomerPerspectiveName.Virtualization);
    },
  );

  describe(
    'Regression: Monitoring - Metrics (Virtualization)',
    { tags: ['@metrics', '@virtualization', '@slow'] },
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

      testMetricsRegression2(CustomerPerspectiveName.Virtualization);
    },
  );

  describe(
    'Regression: Monitoring - Metrics Namespaced (Virtualization)',
    { tags: ['@metrics', '@virtualization', '@slow'] },
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

      testMetricsRegressionNamespace2(CustomerPerspectiveName.Virtualization);
    },
  );
});
