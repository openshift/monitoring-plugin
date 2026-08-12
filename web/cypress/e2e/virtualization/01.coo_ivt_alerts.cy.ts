import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  HYPERCONVERGED_CLUSTER_OPERATOR,
} from '../../support/operators';
import { alerts } from '../../fixtures/monitoring/alert';
import { runAllRegressionAlertsTests } from '../../support/monitoring/01.reg_alerts.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

describe(
  'Regression: Monitoring - Alerts (Virtualization)',
  { tags: ['@alerting', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
      cy.log('Installation: COO and setting up Monitoring Plugin');
    });
  },
);

describe(
  'IVT: Monitoring UIPlugin + Virtualization',
  { tags: ['@alerting', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockVirtualization(HYPERCONVERGED_CLUSTER_OPERATOR);
    });

    it('1. Virtualization perspective - Observe Menu', () => {
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
    });
  },
);

describe(
  'Regression: Monitoring - Alerts (Virtualization)',
  { tags: ['@alerting', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
    });
    // Run tests in Virtualization perspective
    runAllRegressionAlertsTests({
      name: 'Virtualization',
    });
  },
);
