import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testBVTMonitoring } from '../../support/monitoring/00.bvt_monitoring.cy';
import { guidedTour } from '../../views/tour';
import { alerts } from '../../fixtures/monitoring/alert';
import { nav } from '../../views/nav';
import { commonPages } from '../../views/common';

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockCOO();
    });

    it('1. Installation: COO and setting up Monitoring Plugin', () => {
      cy.log('Installation: COO and setting up Monitoring Plugin');
    });
  },
);

describe('Installation: Virtualization', { tags: ['@coo', '@virtualization', '@slow'] }, () => {
  before(() => {
    cy.beforeBlockVirtualization();
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.switchPerspective('Virtualization', 'Fleet virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization'] },
  () => {
    beforeEach(() => {
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
