// Not finished
import { nav } from '../../views/shared/nav';
import { runBVTCOOPersesTests1 } from '../../support/perses/perses_bvt_admin.cy';
import { guidedTour } from '../../views/shared/tour';
import { commonPages } from '../../views/shared/common';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
} from '../../support/shared/operators';

describe(
  'IVT: COO - Dashboards (Perses) - Virtualization perspective',
  { tags: ['@perses-dashboards', '@slow', '@virtualization', '@coo'] },

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
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      commonPages.titleShouldHaveText('Dashboards');
    });

    runBVTCOOPersesTests1({
      name: 'Virtualization',
    });
  },
);
