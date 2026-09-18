import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/shared/nav';
import { testBVTCOOPerses1 } from '../../support/perses/perses_bvt_admin.cy';
import { guidedTour } from '../../views/shared/tour';
import { commonPages } from '../../views/shared/common';

describe(
  'IVT: COO - Dashboards (Perses) - Virtualization perspective',
  { tags: ['@perses-dashboards', '@coo', '@virtualization', '@slow'] },

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
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      commonPages.titleShouldHaveText('Dashboards');
    });

    testBVTCOOPerses1(CustomerPerspectiveName.Virtualization);
  },
);
