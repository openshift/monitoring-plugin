import { listPage } from "./list-page";

export const alertingRuleListPage = {
  shouldBeLoaded: () => {
    cy.log('alertingRuleListPage.shouldBeLoaded');
    listPage.filter.removeMainTag('Source');
    cy.get('.co-m-resource-icon.co-m-resource-alertrule').contains('AR');
    cy.get('.pf-v6-c-table__button, .pf-c-table__button').contains('Name').should('be.visible');
    cy.get('.pf-v6-c-table__button, .pf-c-table__button').contains('Severity').should('be.visible');
    cy.get('.pf-v6-c-table__button, .pf-c-table__button').contains('Alert state').should('be.visible');
    cy.get('.pf-v6-c-table__button, .pf-c-table__button').contains('Source').should('be.visible');

  },

  filter: {

    /**
    * 
    * @param tab alerts-tab, silences, alerting-rules 
    */
    assertNoClearAllFilters: () => {
      cy.log('alertingRuleListPage.filter.assertNoclearAllFilters');
      try {
        cy.bySemanticElement('button').contains('Clear all filters').should('not.exist');
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },

  },

  clickAlertingRule: (alertRule: string) => {
    cy.log('alertingRuleListPage.clickAlertingRule');
    try {
      cy.bySemanticElement('a').contains(alertRule).should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error;
    }
  },

  countShouldBe: (count: number) => {
    cy.log('alertingRuleListPage.countShouldBe');
    cy.byPFRole('grid').eq(1).find('.pf-v6-c-table__tr, .pf-v5-c-table__tr').should('have.length', count);
  },

};
