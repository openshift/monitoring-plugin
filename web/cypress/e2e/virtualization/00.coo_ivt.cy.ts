import { runBVTMonitoringTests } from '../../support/monitoring/00.bvt_monitoring.cy';
import { guidedTour } from '../../views/tour';
import { alerts } from '../../fixtures/monitoring/alert';
import { nav } from '../../views/nav';
import { commonPages } from '../../views/common';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';

// Set constants for the operators that need to be installed for tests.

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
  },
};

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
    });

    it('1. Installation: COO and setting up Monitoring Plugin', () => {
      cy.log('Installation: COO and setting up Monitoring Plugin');
    });
  },
);

describe('Installation: Virtualization', { tags: ['@coo', '@virtualization', '@slow'] }, () => {
  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Virtualization perspective - Observe Menu', () => {
    cy.log('Virtualization perspective - Observe Menu and verify all submenus');
    cy.switchPerspective('Virtualization', 'Fleet virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe(
  'IVT: Monitoring + Virtualization',
  { tags: ['@alerting', '@metrics', '@coo', '@virtualization'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      guidedTour.close();
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
    });

    // Run tests in Administrator perspective
    runBVTMonitoringTests({
      name: 'Virtualization',
    });
  },
);
