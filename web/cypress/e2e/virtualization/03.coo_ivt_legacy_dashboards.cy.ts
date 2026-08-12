import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';
import { runAllRegressionLegacyDashboardsTests } from '../../support/monitoring/03.reg_legacy_dashboards.cy';
import { runAllRegressionLegacyDashboardsTestsNamespace } from '../../support/monitoring/06.reg_legacy_dashboards_namespace.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { guidedTour } from '../../views/tour';

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
  'Regression: Monitoring - Legacy Dashboards (Virtualization)',
  { tags: ['@legacy-dashboards', '@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockCOO(MCP, CLUSTER_MONITORING_OPERATOR);
      cy.log('Installation: COO and setting up Monitoring Plugin');
    });
  },
);

describe(
  'IVT: Monitoring UIPlugin + Virtualization',
  { tags: ['@coo', '@virtualization', '@slow'] },
  () => {
    before(() => {
      cy.beforeBlockVirtualization(KBV);
    });

    it('1. Virtualization perspective - Observe Menu', () => {
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
    });
  },
);

describe(
  'Regression: Monitoring - Legacy Dashboards (Virtualization)',
  { tags: ['@legacy-dashboards', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace('All Projects');
    });

    runAllRegressionLegacyDashboardsTests({
      name: 'Virtualization',
    });
  },
);

describe(
  'Regression: Monitoring - Legacy Dashboards Namespaced (Virtualization)',
  { tags: ['@legacy-dashboards', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    runAllRegressionLegacyDashboardsTestsNamespace({
      name: 'Virtualization',
    });
  },
);
