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
  
  /**
   * 
   * @param action Silence alert, Reset button
   */
  clickPageActionButton: (action: string) => {
    cy.log('detailsPage.clickPageActionButton');
    cy.byLegacyTestID('details-actions')
      .contains(action)
      .click();
  },

  clickAlertRule: (alert: string) => {
    cy.log('detailsPage.clickAlertRule');
    cy.byTestID('alert-rules-detail-resource-link').scrollIntoView();
    try{
      cy.byTestID('alert-rules-detail-resource-link').contains(alert).should('be.visible').click();
      commonPages.detailsPage.alertRule;
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
    
  },
  clickAlertDesc: (desc: string) => {
    cy.log('detailsPage.clickAlertDesc');
    cy.byTestID('active-alerts').scrollIntoView();
    try {
      cy.byTestID('active-alerts').contains(desc).should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },

  clickInspectAlertPage: () =>{
    cy.log('detailsPage.clickInspectAlertPage');
    try {
      cy.get(`a[aria-label="Inspect"]` , { timeout: 10000 }).click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },

  clickOnSilencedBy: (alertname: string) => {
   cy.log('detailsPage.clickOnSilencedBy');
   try {
    cy.byLegacyTestID('silence-resource-link')
      .first()
      .should('have.text', alertname)
      .click();
   } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  
  },
  
  clickOnSilenceByKebab: () => {
    cy.log('detailsPage.clickOnSilenceByKebab');
    try {
      cy.get('[aria-label="Kebab toggle"]').scrollIntoView();
      cy.get('[aria-label="Kebab toggle"]').should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  
  },
  
  editSilence:() => {
    cy.log('detailsPage.editSilence');
    try {
      detailsPage.clickOnSilenceByKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },
  /**
   * 
   * @param yes boolean: true to expire and false to cancel
   */
  expireSilence:(yes: boolean) => {
    cy.log('detailsPage.expireSilence');
    try {
      detailsPage.clickOnSilenceByKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible').click();
      if (yes) {
        cy.byClass('pf-v6-c-button pf-m-primary pf-m-progress').should('be.visible').click();
      } else {
        cy.byClass('pf-v6-c-button pf-m-secondary').should('be.visible').click();
      };
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
    
  }

};
