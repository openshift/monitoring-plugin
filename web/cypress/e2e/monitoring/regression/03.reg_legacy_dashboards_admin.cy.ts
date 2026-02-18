import { runAllRegressionLegacyDashboardsTests } from '../../../support/monitoring/03.reg_legacy_dashboards.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Legacy Dashboards (Administrator)', { tags: ['@monitoring', '@dashboards'] }, () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    //when running only this file, beforeBlock changes the namespace to openshift-monitoring
    //so we need to change it back to All Projects before landing to Dashboards page in order to have API Performance dashboard loaded by default
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    commonPages.titleShouldHaveText('Dashboards');
    
  });

  // Run tests in Administrator perspective
  runAllRegressionLegacyDashboardsTests({
    name: 'Administrator',
  });

});
