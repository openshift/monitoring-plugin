import { nav } from '../../views/nav';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { runBVTMonitoringTestsNamespace } from '../../support/alerts/alerts_bvt_namespaced.cy';
import { commonPages } from '../../views/common';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/shared/operators';

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
  runBVTMonitoringTestsNamespace({
    name: 'Administrator',
  });
});
