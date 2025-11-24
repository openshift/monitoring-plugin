import { nav } from '../../views/nav';
import { alerts } from '../../fixtures/monitoring/alert';
import { guidedTour } from '../../views/tour';
import { runBVTMonitoringTestsNamespace } from '../../support/monitoring/00.bvt_monitoring_namespace.cy';
import { commonPages } from '../../views/common';
import { overviewPage } from '../../views/overview-page';
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('BVT: Monitoring - Namespaced', { tags: ['@monitoring-dev', '@smoke-dev'] }, () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    alerts.getWatchdogAlert();
    cy.changeNamespace(MP.namespace);
  });

  // Run tests in Administrator perspective
  runBVTMonitoringTestsNamespace({  
    name: 'Administrator',
  });

});