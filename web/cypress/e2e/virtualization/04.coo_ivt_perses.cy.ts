import { nav } from '../../views/nav';
import { runBVTCOOPersesTests } from '../../support/perses/00.coo_bvt_perses_admin.cy';
import { guidedTour } from '../../views/tour';
import { commonPages } from '../../views/common';

// Set constants for the operators that need to be installed for tests.
const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const KBV = {
  namespace: 'openshift-cnv',
  packageName: 'kubevirt-hyperconverged',
  config: {
    kind: 'HyperConverged',
    name: 'kubevirt-hyperconverged',
  },
  crd: {
    kubevirt: 'kubevirts.kubevirt.io',
    hyperconverged: 'hyperconvergeds.hco.kubevirt.io',
  }
};

describe('Installation: COO and setting up Monitoring Plugin', { tags: ['@virtualization', '@slow'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  it('1. Installation: COO and setting up Monitoring Plugin', () => {
    cy.log('Installation: COO and setting up Monitoring Plugin');
  });
});

describe('Installation: Virtualization', { tags: ['@virtualization', '@slow'] }, () => {

  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Installation: Virtualization', () => {
    cy.log('Installation: Virtualization');
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe('IVT: COO - Dashboards (Perses) - Virtualization perspective', { tags: ['@virtualization', '@perses'] }, () => {

  beforeEach(() => {
    cy.visit('/');
    guidedTour.close();
    cy.validateLogin();
    cy.switchPerspective('Virtualization');
    guidedTour.closeKubevirtTour();
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    commonPages.titleShouldHaveText('Dashboards');
  });

  runBVTCOOPersesTests({
    name: 'Virtualization',
  });

});