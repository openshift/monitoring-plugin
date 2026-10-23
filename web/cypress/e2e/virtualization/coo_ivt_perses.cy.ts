import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { testBVTCOOPerses1 } from '../../support/perses/coo_bvt_perses_admin.cy';
import { guidedTour } from '../../views/tour';
import { commonPages } from '../../views/common';

describe(
  'IVT: COO - Dashboards (Perses) - Virtualization perspective',
  { tags: ['@perses-dashboards', '@coo', '@virtualization', '@slow'] },
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
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      commonPages.titleShouldHaveText('Dashboards');
    });

    testBVTCOOPerses1(CustomerPerspectiveName.Virtualization);
  },
);
