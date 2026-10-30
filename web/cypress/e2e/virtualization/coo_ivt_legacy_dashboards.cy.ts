import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';
import { testLegacyDashboardsRegression } from '../../support/monitoring/reg_legacy_dashboards.cy';
import { testLegacyDashboardsRegressionNamespace } from '../../support/monitoring/reg_legacy_dashboards_namespace.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

describe(
  'Regression: Monitoring - Legacy Dashboards (Virtualization)',
  { tags: ['@legacy-dashboards', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.ensureVirtualization();
    });

    beforeEach(() => {
      cy.restoreLogin();
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
    before(() => {
      cy.ensureMonitoringConsolePlugin();
      cy.ensureVirtualization();
    });

    beforeEach(() => {
      cy.restoreLogin();
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
