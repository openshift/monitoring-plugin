import { HYPERCONVERGED_CLUSTER_OPERATOR } from '../../support/operators';
import { guidedTour } from '../../views/tour';
import { troubleshootingPanelPage } from '../../views/troubleshooting-panel';

describe(
  'IVT: Monitoring UIPlugin + Virtualization',
  { tags: ['@alerting', '@coo', '@virtualization'] },
  () => {
    before(() => {
      cy.beforeBlockVirtualization(HYPERCONVERGED_CLUSTER_OPERATOR);
    });

    it('1. Virtualization perspective - Observe Menu', () => {
      cy.log('Virtualization perspective - Observe Menu and verify all submenus');
      cy.switchPerspective('Virtualization', 'Fleet virtualization');
      guidedTour.closeKubevirtTour();
      troubleshootingPanelPage.signalCorrelationShouldNotBeVisible();
      cy.switchPerspective('Core platform', 'Administrator');
    });

    /**
     * TODO: To be replaced by COO validation such as Dashboards (Perses) scenarios
     */
  },
);
