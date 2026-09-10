import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { troubleshootingPanelPage } from '../../views/troubleshooting-panel';

describe('BVT: COO', { tags: ['@alerting', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR);
  });

  it('1. Admin perspective - Observe Menu', () => {
    cy.log('Admin perspective - Observe Menu and verify all submenus');
    cy.reload(true);
    cy.wait(10000);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    nav.tabs.switchTab('Silences');
    nav.tabs.switchTab('Alerting rules');
    nav.tabs.switchTab('Incidents');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    commonPages.titleShouldHaveText('Dashboards');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    troubleshootingPanelPage.openSignalCorrelation();
    troubleshootingPanelPage.troubleshootingPanelPageShouldBeLoadedEnabled();
  });

  /**
   * TODO: To be replaced by COO validation such as Dashboards (Perses) scenarios
   */
});
