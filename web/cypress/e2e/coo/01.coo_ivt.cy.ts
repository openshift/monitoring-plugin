import { guidedTour } from '../../views/tour';
import { troubleshootingPanelPage } from '../../views/troubleshooting-panel';

// Set constants for the operators that need to be installed for tests.
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

describe('IVT: Monitoring UIPlugin + Virtualization', { tags: ['@smoke', '@coo'] }, () => {

  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    troubleshootingPanelPage.signalCorrelationShouldNotBeVisible();
    cy.switchPerspective('Core platform', 'Administrator');

  });

  /**
   * TODO: To be replaced by COO validation such as Dashboards (Perses) scenarios
   */

});
