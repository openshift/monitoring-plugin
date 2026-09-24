import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testBVTAlerts } from '../../support/alerts/alerts_bvt.cy';
import { guidedTour } from '../../views/shared/tour';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { nav } from '../../views/shared/nav';
import { commonPages } from '../../views/shared/common';
import { troubleshootingPanelPage } from '../../views/shared/troubleshooting-panel';

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.log('Installation: COO and setting up Monitoring Plugin');
      cy.beforeBlockVirtualization();
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
    });
    beforeEach(() => {
      cy.visit('/');
      guidedTour.close();
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      troubleshootingPanelPage.signalCorrelationShouldNotBeVisible();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
    });

    testBVTAlerts(CustomerPerspectiveName.Virtualization);
  },
);
