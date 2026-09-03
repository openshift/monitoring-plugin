import { CLUSTER_MONITORING_OPERATOR } from '../../../support/operators';
import { alerts } from '../../../fixtures/monitoring/alert';
import { testAlertsRegressionNamespace } from '../../../support/monitoring/04.reg_alerts_namespace.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';

describe(
  'Regression: Monitoring - Alerts Namespaced (Administrator)',
  { tags: ['@alerting'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    testAlertsRegressionNamespace(CustomerPerspectiveName.CorePlatform);
  },
);
