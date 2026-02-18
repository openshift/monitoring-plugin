import { commonPages } from "./common";
import { detailsPage } from "./details-page";
import { DataTestIDs, Classes } from '../../src/components/data-test'; 

export const alertingRuleDetailsPage = {
  assertAlertingRuleDetailsPage: (title: string) => {
      cy.log('alertingRuleDetailsPage.assertAlertingRuleDetailsPage');
      commonPages.titleShouldHaveText(title);
      cy.get(Classes.AlertingRuleResourceIcon).contains('AR').should('be.visible');
      detailsPage.sectionHeaderShouldExist('Alerting rule details');
      detailsPage.sectionHeaderShouldExist('Active alerts');
      cy.get(Classes.Expression).should('be.visible');
      cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
      cy.bySemanticElement('button').contains('Reset zoom').should('be.visible');
      cy.byAriaLabel('View in Metrics').should('be.visible');
    },
  
    clickOnActiveAlerts: (desc: string) => {
      cy.log('alertingRuleDetailsPage.clickOnActiveAlerts');
      cy.byTestID(DataTestIDs.AlertResourceLink)
        .first()
        .should('have.text', desc)
        .click();
    },
  
    clickAlertingRulesBreadcrumb:() => {
      cy.log('alertingRuleDetailsPage.clickAlertingRulesBreadcrumb');
       try {
        cy.byTestID(DataTestIDs.Breadcrumb).contains('Alerting rules').click();
        } catch (error) {
          cy.log(`${error.message}`);
          throw error; 
        }
    },

    assertKebabNoSilenceAlert: () => {
      cy.log('alertingRuleDetailsPage.assertKebabNoSilenceAlert');
      try {
        cy.byTestID(DataTestIDs.AlertingRuleDetailsResourceLink).scrollIntoView();
        cy.byAriaLabel('toggle menu').should('not.exist');
      }catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    },

    clickOnKebabSilenceAlert:()=>{
      cy.log('alertingRuleDetailsPage.clickOnKebabSilenceAlert');
      cy.byAriaLabel('toggle menu').scrollIntoView().should('be.visible').click();
      cy.byPFRole('menuitem').contains('Silence alert').should('be.visible').click();
    },

    clickHideGraphButton:()=>{
      cy.log('alertingRuleDetailsPage.clickHideGraphButton');
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton).scrollIntoView().contains('Hide graph').should('be.visible').click();
      cy.byTestID(DataTestIDs.MetricGraph).should('not.exist');
    },

    clickShowGraphButton:()=>{
      cy.log('alertingRuleDetailsPage.clickShowGraphButton');
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton).scrollIntoView().contains('Show graph').should('be.visible').click();
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
    },
};
