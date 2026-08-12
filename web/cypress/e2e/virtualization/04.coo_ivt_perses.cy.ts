import { nav } from '../../views/nav';
import { runBVTCOOPersesTests1 } from '../../support/perses/00.coo_bvt_perses_admin.cy';
import { guidedTour } from '../../views/tour';
import { commonPages } from '../../views/common';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';

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
  'IVT: COO - Dashboards (Perses) - Virtualization perspective',
  { tags: ['@perses-dashboards', '@coo', '@virtualization', '@slow'] },

  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
    });

    it('1. Installation: COO and setting up Monitoring Plugin', () => {
      cy.log('Installation: COO and setting up Monitoring Plugin');
    });
  },
);

describe('Installation: Virtualization', { tags: ['@virtualization', '@slow'] }, () => {
  before(() => {
    cy.beforeBlockVirtualization(KBV);
  });

  it('1. Installation: Virtualization', () => {
    cy.log('Installation: Virtualization');
    cy.switchPerspective('Virtualization', 'Fleet virtualization');
    guidedTour.closeKubevirtTour();
  });
});

describe(
  'IVT: COO - Dashboards (Perses) - Virtualization perspective',
  { tags: ['@perses-dashboards', '@coo', '@virtualization', '@slow'] },
  () => {
    beforeEach(() => {
      cy.visit('/');
      guidedTour.close();
      cy.validateLogin();
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      commonPages.titleShouldHaveText('Dashboards');
    });

    runBVTCOOPersesTests1({
      name: 'Virtualization',
    });
  },
);
