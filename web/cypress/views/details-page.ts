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
  
  assertSilencedAlert: () => {
    cy.log('detailsPage.assertSilencedAlert');
    try {
      cy.byClass('pf-v6-c-button__text').contains('Silence alert').should('not.exist');
      cy.get('[aria-label="Kebab toggle"]').scrollIntoView();
      cy.get('[aria-label="Kebab toggle"]').should('be.visible').click();
      cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible');
      cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible');

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
      commonPages.confirmExpireAlert(yes);
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
    
  },
  clickSilenceAlertButton:()=>{
    cy.log('detailsPage.clickSilenceAlertButton');
    cy.byClass('pf-v6-c-button__text').contains('Silence alert').should('be.visible').click();
  },

  clickResetZoomButton:()=>{
    cy.log('detailsPage.clickResetZoomButton');
    cy.byClass('pf-v6-c-button__text').contains('Reset zoom').should('be.visible').click();
  },

  clickHideGraphButton:()=>{
    cy.log('detailsPage.clickHideGraphButton');
    cy.byClass('pf-v6-c-button__text').contains('Hide graph').should('be.visible').click();
    cy.byClass('pf-v6-c-card pf-m-compact').should('not.exist');
  },

  clickShowGraphButton:()=>{
    cy.log('detailsPage.clickShowGraphButton');
    cy.byClass('pf-v6-c-button__text').contains('Show graph').should('be.visible').click();
    cy.byClass('pf-v6-c-card pf-m-compact').should('be.visible');
  }

};
