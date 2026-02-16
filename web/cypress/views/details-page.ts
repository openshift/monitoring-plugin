import { commonPages } from "./common";
import { DataTestIDs, Classes } from "../../src/components/data-test";

export const detailsPage = {
  sectionHeaderShouldExist: (sectionHeading: string) => {
    cy.log('detailsPage.sectionHeaderShouldExist');
    cy.get(Classes.SectionHeader).contains(sectionHeading).should('be.visible');
  },
    
  labelShouldExist: (labelName: string) => {
    cy.log('detailsPage.labelShouldExist');
    cy.get(Classes.LabelTag).contains(labelName);
  },

  clickAlertRule: (alert: string) => {
    cy.log('detailsPage.clickAlertRule');
    cy.byTestID(DataTestIDs.AlertRulesDetailResourceLink).scrollIntoView();
    try{
      cy.byTestID(DataTestIDs.AlertRulesDetailResourceLink).contains(alert).should('be.visible').click();
      commonPages.detailsPage.alertRule;
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },

  clickAlertDesc: (desc: string) => {
    cy.log('detailsPage.clickAlertDesc');
    cy.byTestID(DataTestIDs.AlertingRuleDetailsResourceLink).scrollIntoView();
    try {
      cy.byTestID(DataTestIDs.AlertingRuleDetailsResourceLink).contains(desc).should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },

  clickInspectAlertPage: () =>{
    cy.log('detailsPage.clickInspectAlertPage');
    try {
      cy.byAriaLabel('View in Metrics').should('be.visible');
      cy.get(`a[aria-label="View in Metrics"]` , { timeout: 10000 }).click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },

  clickOnSilencedBy: (alertname: string) => {
   cy.log('detailsPage.clickOnSilencedBy');
   try {
    cy.byLegacyTestID(DataTestIDs.SilenceResourceLink)
      .contains(alertname)
      .scrollIntoView();
      cy.byLegacyTestID(DataTestIDs.SilenceResourceLink)
      .contains(alertname)
      .click({force: true});
   } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
    cy.wait(5000);
  },
  
  assertSilencedAlert: () => {
    cy.log('detailsPage.assertSilencedAlert');
    try {
      cy.get('body').find('button:contains("Silence alert")').should('have.length', 0);
      detailsPage.clickOnSilenceByKebab();
      cy.byPFRole('menuitem').contains('Edit silence').should('be.visible');
      cy.byPFRole('menuitem').contains('Expire silence').should('be.visible');

    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },

  clickOnSilenceByKebab: () => {
    cy.log('detailsPage.clickOnSilenceByKebab');
    try {
      cy.byLegacyTestID(DataTestIDs.SilenceResourceLink).scrollIntoView();
      cy.get('table').should('be.visible');
      cy.wait(2000);
      cy.get('table').find(Classes.SilenceKebabDropdown).should('be.visible');
      cy.get('table').find(Classes.SilenceKebabDropdown).should('be.visible').click({force: true});
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
  },
  
  editSilence:() => {
    cy.log('detailsPage.editSilence');
    try {
      detailsPage.clickOnSilenceByKebab();
      cy.byPFRole('menuitem').contains('Edit silence').should('be.visible').click();
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
      cy.byPFRole('menuitem').contains('Expire silence').should('be.visible').click({force: true});
      commonPages.confirmExpireAlert(yes);
    } catch (error) {
      cy.log(`${error.message}`);
      throw error; 
    }
    
    
  },
  clickSilenceAlertButton:()=>{
    cy.log('detailsPage.clickSilenceAlertButton');
    cy.bySemanticElement('button', 'Silence alert').should('be.visible').click();
  },

  
};
