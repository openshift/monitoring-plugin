import { alerts } from '../../../fixtures/monitoring/alert';
import { runAllRegressionAlertsTestsNamespace } from '../../../support/monitoring/04.reg_alerts_namespace.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Monitoring - Alerts Namespaced (Administrator)', { tags: ['@monitoring-dev', '@alerts-dev'] }, () => {

    before(() => {
      cy.beforeBlock(MP);
    });

    beforeEach(() => {
      alerts.getWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.getWatchdogAlert();
      cy.changeNamespace(MP.namespace);
    });
  
    // Run tests in Administrator perspective
    runAllRegressionAlertsTestsNamespace({
      name: 'Administrator',
    });
  
});

