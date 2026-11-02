import { runAllOverviewTests } from '../../support/monitoring/overview.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { overview } from '../../views/overview';

describe('COO - Overview', { tags: ['@overview', '@coo'] }, () => {
  before(() => {
    cy.ensureMonitoringConsolePlugin();
  });

  beforeEach(() => {
    cy.restoreLogin();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    overview.clearInfoAlertDismissed();
  });

  runAllOverviewTests({
    name: 'Administrator',
  });
});
