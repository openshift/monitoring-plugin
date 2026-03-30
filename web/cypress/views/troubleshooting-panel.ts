import { DataTestIDs, LegacyTestIDs } from '../../src/components/data-test';

export const troubleshootingPanelPage = {
  openSignalCorrelation: () => {
    cy.log('troubleshootingPanelPage.openSignalCorrelation');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
    cy.wait(3000);
    cy.byTestID(DataTestIDs.MastHeadApplicationItem)
      .contains('Signal Correlation')
      .should('be.visible')
      .click();
    cy.wait(3000);
  },

  signalCorrelationShouldNotBeVisible: () => {
    cy.log('troubleshootingPanelPage.signalCorrelationShouldNotBeVisible');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
    cy.byTestID(DataTestIDs.MastHeadApplicationItem)
      .contains('Signal Correlation')
      .should('not.exist');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
  },

  troubleshootingPanelPageShouldBeLoadedEnabled: () => {
    cy.log('troubleshootingPanelPage.troubleshootingPanelPageShouldBeLoadedEnabled');
    cy.get('h1').contains('Troubleshooting').should('be.visible');
    cy.byAriaLabel('Close').should('be.visible');
    cy.byButtonText('Focus').should('be.visible');
    cy.get('#query-toggle').should('be.visible');
    //svg path for refresh button
    cy.byAriaLabel('Refresh').should('be.visible');
    cy.byDataID('korrel8r_graph').should('be.visible');
  },
};
