import { runAllRegressionAlertsTests } from '../../support/monitoring/01.reg_alerts.cy';
import { runAllRegressionAlertsTestsNamespace } from '../../support/monitoring/04.reg_alerts_namespace.cy';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const KBV = {
  namespace: 'openshift-cnv',
  packageName: 'kubevirt-hyperconverged',
  operatorName: 'kubevirt-hyperconverged-operator.v4.19.6',
  config: {
    kind: 'HyperConverged',
    name: 'kubevirt-hyperconverged',
  },
  crd: {
    kubevirt: 'kubevirts.kubevirt.io',
    hyperconverged: 'hyperconvergeds.hco.kubevirt.io',
  }
};

describe('IVT: Monitoring UIPlugin + Virtualization', () => {

  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.switchPerspective('Virtualization');
    cy.byAriaLabel('Welcome modal').should('be.visible');
    guidedTour.closeKubevirtTour();
  });
});

describe('Regression: Monitoring - Alerts (Virtualization)', () => {

  beforeEach(() => {
    cy.visit('/');
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace("All Projects");
  });
  // Run tests in Virtualization perspective
  runAllRegressionAlertsTests({
    name: 'Virtualization',
  });

});

describe('Regression: Monitoring - Alerts Namespaced (Virtualization)', () => {

  beforeEach(() => {
    cy.visit('/');
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace(MP.namespace);
  });
  // Run tests in Virtualization perspective
  runAllRegressionAlertsTestsNamespace({
    name: 'Virtualization',

  });

});
