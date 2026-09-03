import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { alerts } from '../../fixtures/monitoring/alert';
import { testBVTMonitoring } from '../../support/monitoring/00.bvt_monitoring.cy';
import { commonPages } from '../../views/common';
import { overviewPage } from '../../views/overview-page';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

describe(
  'BVT: Monitoring',
  { tags: ['@alerting', '@legacy-dashboards', '@metrics', '@targets'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
    });

    it(`1. Admin perspective - Observe Menu`, () => {
      cy.log(`Admin perspective - Observe Menu and verify all submenus`);
      nav.sidenav.clickNavLink(['Administration', 'Cluster Settings']);
      commonPages.detailsPage.administration_clusterSettings();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      nav.tabs.switchTab('Silences');
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      nav.sidenav.clickNavLink(['Observe', 'Targets']);
      commonPages.titleShouldHaveText('Metrics targets');
    });
    // TODO: Intercept Bell GET request to inject an alert (Watchdog to have it opened in
    // Alert Details page?)
    // it('Admin perspective - Bell > Alert details > Alerting rule details > Metrics flow', () => {
    //   cy.visit('/');
    //   commonPages.clickBellIcon();
    //   commonPages.bellIconClickAlert('TargetDown');
    //   commonPages.titleShouldHaveText('TargetDown')

    // });

    it(`2. Admin perspective - Overview Page > Status - View alerts`, () => {
      nav.sidenav.clickNavLink(['Home', 'Overview']);
      overviewPage.clickStatusViewAlerts();
      commonPages.titleShouldHaveText('Alerting');
    });

    // TODO: Intercept and inject a valid alert into status-card to be opened correctly to Alerting
    // Alerts page
    // I couldn't make Watchdog working on status-card
    // it('3. Admin perspective - Overview Page > Status - View details', () => {
    //   cy.visit('/');
    //   nav.sidenav.clickNavLink(['Home', 'Overview']);
    //   overviewPage.clickStatusViewDetails(0);
    //   detailsPage.sectionHeaderShouldExist('Alert details');
    // });

    it(`3. Admin perspective - Cluster Utilization - Metrics`, () => {
      nav.sidenav.clickNavLink(['Home', 'Overview']);
      overviewPage.clickClusterUtilizationViewCPU();
      commonPages.titleShouldHaveText('Metrics');
      commonPages.projectDropdownShouldExist();
    });

    // Run tests in Administrator perspective
    testBVTMonitoring(CustomerPerspectiveName.CorePlatform);
  },
);
