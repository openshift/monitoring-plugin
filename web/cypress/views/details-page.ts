import { commonPages } from "./common";

export const detailsPage = {
  sectionHeaderShouldExist: (sectionHeading: string) => {
    cy.log('detailsPage.sectionHeaderShouldExist');
    cy.byClass('pf-v6-c-title pf-m-h2').contains(sectionHeading).should('be.visible');
  },
    
  labelShouldExist: (labelName: string) => {
    cy.log('detailsPage.labelShouldExist');
    cy.byClass('pf-v6-c-label__text').contains(labelName);
  },
    
  clickPageActionButton: (action: string) => {
    cy.log('detailsPage.clickPageActionButton');
    cy.byLegacyTestID('details-actions')
      .contains(action)
      .click();
  },

  clickAlertRule: (alert: string) => {
    cy.log('detailsPage.clickAlertRule');
    cy.byTestID('alert-rules-detail-resource-link').scrollIntoView();
    cy.byTestID('alert-rules-detail-resource-link').contains(alert).should('be.visible').click();
    commonPages.detailsPage.alertRule;
    
  },
  clickAlertDesc: (desc: string) => {
    cy.log('detailsPage.clickAlertDesc');
    cy.byTestID('active-alerts').scrollIntoView();
    cy.byTestID('active-alerts').contains(desc).should('be.visible').click();
  },

  clickInspectAlertPage: () =>{
    cy.log('detailsPage.clickInspectAlertPage');
    cy.get(`[aria-label="Inspect"]`).contains('Inspect').should('be.visible').click();

  },

  assertExpressionInMetrics: () => {
    cy.log('detailsPage.assertExpressionInMetrics');
    cy.byClass('cm-line').should('be.visible');
    cy.byClass('cm-line').invoke('text').then((fullText) => {
    });
  },

  clickOnSilencedBy: (alertname: string) => {
   cy.log('detailsPage.clickOnSilencedBy');
    cy.byLegacyTestID('silence-resource-link')
     .first()
     .should('have.text', 'Watchdog')
     .click();

  }


};
