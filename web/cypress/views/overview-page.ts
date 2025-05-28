import { commonPages } from "./common";

export const overviewPage = {

  shouldBeLoaded: () => {
    cy.log('overviewPage.shouldBeLoaded');
    commonPages.titleShouldHaveText('Overview');

  },

  clickStatusViewAlerts: () => {
    cy.log('overviewPage.clickStatusViewAlerts');
    cy.byTestID('status-card-view-alerts').should('be.visible').click();
  },

  clickStatusViewDetails: (position: number) => {
    cy.log('overviewPage.clickStatusViewAlerts');
    cy.byClass('co-status-card__alert-item-more').eq(position).should('be.visible').click();
  },

  clickClusterUtilizationViewCPU: () => {
    cy.log('overviewPage.clickClusterUtilizationViewCPU');
    cy.get('[aria-label="View CPU metrics in query browser"]').scrollIntoView().should('be.visible').click();
  }
 
}
