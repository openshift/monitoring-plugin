import { DataTestIDs, Classes, LegacyTestIDs, IDs } from "../../src/components/data-test";

export const troubleshootingPanelPage = {

  openSignalCorrelation: () => {
    cy.log('troubleshootingPanelPage.openSignalCorrelation');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
    cy.wait(3000);
    cy.byTestID(DataTestIDs.MastHeadApplicationItem).contains('Signal Correlation').should('be.visible').click();
    cy.wait(3000);
  },

  signalCorrelationShouldNotBeVisible: () => {
    cy.log('troubleshootingPanelPage.signalCorrelationShouldNotBeVisible');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
    cy.byTestID(DataTestIDs.MastHeadApplicationItem).contains('Signal Correlation').should('not.exist');
    cy.byLegacyTestID(LegacyTestIDs.ApplicationLauncher).should('be.visible').click();
  },

  troubleshootingPanelPageShouldBeLoadedEnabled: () => {
    cy.log('troubleshootingPanelPage.troubleshootingPanelPageShouldBeLoadedEnabled');
    cy.get('h1').contains('Troubleshooting').should('be.visible');
    cy.byAriaLabel('Close').should('be.visible');
    cy.byButtonText('Focus').should('be.visible');
    cy.get('#query-toggle').should('be.visible');
    //svg path for refresh button
    cy.get('.tp-plugin__panel-query-container').find('path').eq(1).should('have.attr', 'd', 'M440.65 12.57l4 82.77A247.16 247.16 0 0 0 255.83 8C134.73 8 33.91 94.92 12.29 209.82A12 12 0 0 0 24.09 224h49.05a12 12 0 0 0 11.67-9.26 175.91 175.91 0 0 1 317-56.94l-101.46-4.86a12 12 0 0 0-12.57 12v47.41a12 12 0 0 0 12 12H500a12 12 0 0 0 12-12V12a12 12 0 0 0-12-12h-47.37a12 12 0 0 0-11.98 12.57zM255.83 432a175.61 175.61 0 0 1-146-77.8l101.8 4.87a12 12 0 0 0 12.57-12v-47.4a12 12 0 0 0-12-12H12a12 12 0 0 0-12 12V500a12 12 0 0 0 12 12h47.35a12 12 0 0 0 12-12.6l-4.15-82.57A247.17 247.17 0 0 0 255.83 504c121.11 0 221.93-86.92 243.55-201.82a12 12 0 0 0-11.8-14.18h-49.05a12 12 0 0 0-11.67 9.26A175.86 175.86 0 0 1 255.83 432z');
    cy.byDataID('korrel8r_graph').should('be.visible');
  },

  
};