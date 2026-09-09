import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
} from '../../support/shared/operators';
import { testLegacyDashboardsRegression } from '../../support/legacy-dashboards/legacy_dashboards_regressions.cy';
import { testLegacyDashboardsRegressionNamespace } from '../../support/legacy-dashboards/legacy_dashboards_regressions_namespaced.cy';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';
import { guidedTour } from '../../views/shared/tour';

describe(
  'Regression: Monitoring - Legacy Dashboards (Virtualization)',
  { tags: ['@legacy-dashboards', '@coo', '@virtualization', '@slow'] },
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
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace('All Projects');
    });

    testLegacyDashboardsRegression(CustomerPerspectiveName.Virtualization);
  },
);

describe(
  'Regression: Monitoring - Legacy Dashboards Namespaced (Virtualization)',
  { tags: ['@legacy-dashboards', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    testLegacyDashboardsRegressionNamespace(CustomerPerspectiveName.Virtualization);
  },
);
