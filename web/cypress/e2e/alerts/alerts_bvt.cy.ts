import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { testBVTMonitoringTestsNamespace } from '../../support/alerts/alerts_bvt_namespaced.cy';
import { commonPages } from '../../views/common';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

describe('BVT: Monitoring - Namespaced', { tags: ['@alerting', '@metrics'] }, () => {
  before(() => {
    cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
  });

  beforeEach(() => {
    alerts.interceptWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    alerts.interceptWatchdogAlert();
    cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
  });

  // Run tests in Administrator perspective
  testBVTMonitoringTestsNamespace(CustomerPerspectiveName.CorePlatform);
});
