import { runAllOverviewTests } from '../../support/monitoring/01.overview.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { overview } from '../../views/overview';

describe('COO - Overview', { tags: ['@overview', '@coo'] }, () => {
  before(() => {
    cy.beforeBlockCOO();
  });

  // testIsolation is disabled, so each test starts from a known page rather than a reload.
  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    overview.clearInfoAlertDismissed();
  });

  runAllOverviewTests({
    name: 'Administrator',
  });
});
