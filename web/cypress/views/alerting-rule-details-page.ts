import { commonPages } from "./common";
import { detailsPage } from "./details-page";

export const alertingRuleDetailsPage = {
  assertAlertingRuleDetailsPage: (title: string) => {
      cy.log('alertingRuleDetailsPage.assertAlertingRuleDetailsPage');
      commonPages.titleShouldHaveText(title);
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR').should('be.visible');
      detailsPage.sectionHeaderShouldExist('Alerting rule details');
      detailsPage.sectionHeaderShouldExist('Active alerts');
      cy.byClass('pf-v6-c-code-block__code').should('be.visible');
      cy.byClass('pf-v6-c-button__text').contains('Hide graph').should('be.visible');
      cy.byClass('pf-v6-c-card pf-m-compact').should('be.visible');
    },
  
    clickOnActiveAlerts: (desc: string) => {
      cy.log('silenceDetailsPage.clickOnActiveAlerts');
      cy.byTestID('active-alerts')
        .first()
        .should('have.text', desc)
        .click();
    },
  
    clickActions: (toOpen: boolean) => {
      cy.log('silenceDetailsPage.clickActions');
      if (toOpen) {
        cy.byClass('pf-v6-c-menu-toggle').eq(0).click();
      }
    },
  
    clickAlertingRulesBreadcrumb:() => {
      cy.log('silenceDetailsPage.clickAlertingRulesBreadcrumb');
       try {
         cy.get('.pf-v6-c-breadcrumb__list > :nth-child(1) > a').contains('Alerting rules').click();
        } catch (error) {
          cy.log(`${error.message}`);
          throw error; 
        }
    },

    assertNoKebab: () => {
      cy.log('silenceDetailsPage.assertNoKebab');
      try {
        cy.byLegacyTestID('kebab-button').should('not.exist');
      }catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    },

    clickOnKebabSilenceAlert:()=>{
      cy.log('silenceDetailsPage.clickOnKebabSilenceAlert');
      cy.byLegacyTestID('kebab-button').scrollIntoView().should('be.visible').click();
      cy.byClass('pf-v6-c-menu__item-text').contains('Silence alert').should('be.visible').click();
    }


};
