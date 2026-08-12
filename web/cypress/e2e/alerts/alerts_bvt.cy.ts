import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { nav } from '../../views/nav';
import { alerts } from '../../fixtures/monitoring/alert';
import { testBVTMonitoringTestsNamespace } from '../../support/monitoring/00.bvt_monitoring_namespace.cy';
import { commonPages } from '../../views/common';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

describe('BVT: Monitoring - Namespaced', { tags: ['@alerting', '@metrics'] }, () => {
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
  testBVTMonitoringTestsNamespace(CustomerPerspectiveName.CorePlatform);
});
