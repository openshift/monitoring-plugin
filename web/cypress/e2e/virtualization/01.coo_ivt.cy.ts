import { runBVTMonitoringTests } from '../../support/monitoring/00.bvt_monitoring.cy';
import { runBVTMonitoringTestsNamespace } from '../../support/monitoring/00.bvt_monitoring_namespace.cy';
import { guidedTour } from '../../views/tour';
import { alerts } from '../../fixtures/monitoring/alert';
import { nav } from '../../views/nav';

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

describe('Setting up Monitoring Plugin', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  it('1. Setting up Monitoring Plugin', () => {
    cy.log('Setting up Monitoring Plugin');
  });
});

describe('Installation: Virtualization', () => {

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

describe('IVT: Monitoring + Virtualization', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace("All Projects");
    alerts.getWatchdogAlert();
  });

  // Run tests in Administrator perspective
  runBVTMonitoringTests({
    name: 'Virtualization',
  });

});

describe('IVT: Monitoring + Virtualization - Namespaced', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    alerts.getWatchdogAlert();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace(MP.namespace);
    alerts.getWatchdogAlert();
  });

  // Run tests in Administrator perspective
  runBVTMonitoringTestsNamespace({  
    name: 'Virtualization',
  });

});