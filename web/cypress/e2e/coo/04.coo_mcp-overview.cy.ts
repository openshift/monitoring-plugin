import { runAllMcpOverviewTests } from '../../support/coo/04.coo_mcp-overview-page.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { mcpOverviewPage } from '../../views/mcp-overview-page';

// Set constants for the operators that need to be installed for tests.
const MCP = {
  namespace: Cypress.env('COO_NAMESPACE'),
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

describe('COO - MCP Overview', { tags: ['@coo', '@mcp-overview'] }, () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    mcpOverviewPage.clearInfoAlertDismissed();
    mcpOverviewPage.goTo();
  });

  runAllMcpOverviewTests({
    name: 'Administrator',
  });
});
