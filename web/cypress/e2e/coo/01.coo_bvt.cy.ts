import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';

describe('BVT: COO', { tags: ['@alerting', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockCOO();
  });

  it('1. Admin perspective - Observe Menu', () => {
    cy.log('Admin perspective - Observe Menu and verify all submenus');
    cy.reload(true);
    cy.wait(10000);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    nav.tabs.switchTab('Silences');
    nav.tabs.switchTab('Alerting rules');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    commonPages.titleShouldHaveText('Dashboards');
  });

  /**
   * TODO: To be replaced by COO validation such as Dashboards (Perses) scenarios
   */
});
