import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testBVTMonitoring } from '../../support/monitoring/bvt_monitoring.cy';
import { guidedTour } from '../../views/tour';
import { alerts } from '../../fixtures/monitoring/alert';
import { nav } from '../../views/nav';
import { commonPages } from '../../views/common';

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.ensureVirtualization();
    });

    beforeEach(() => {
      cy.restoreLogin();
      cy.visit('/');
      guidedTour.close();
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

    // Run tests in Administrator perspective
    testBVTMonitoring(CustomerPerspectiveName.Virtualization);
  },
);
