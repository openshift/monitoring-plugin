import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testBVTAlerts } from '../../support/alerts/alerts_bvt.cy';
import { guidedTour } from '../../views/shared/tour';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { nav } from '../../views/shared/nav';
import { commonPages } from '../../views/shared/common';
import { troubleshootingPanelPage } from 'cypress/views/shared/troubleshooting-panel';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
} from '../../support/shared/operators';

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization', '@slow'] },
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
