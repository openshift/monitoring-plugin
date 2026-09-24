import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { testAlertsRegression } from '../../support/alerts/alerts_regressions.cy';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';
import { guidedTour } from '../../views/shared/tour';

describe(
  'Regression: Monitoring - Alerts (Virtualization)',
  { tags: ['@alerting', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.log('Installation: COO and setting up Monitoring Plugin');
      cy.beforeBlockVirtualization();
    });

    it('1. Virtualization perspective - Observe Menu', () => {
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
    });

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
    testAlertsRegression(CustomerPerspectiveName.Virtualization);
  },
);
