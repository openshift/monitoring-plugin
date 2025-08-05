import { DataTestIDs, Classes } from "../../src/components/data-test";
import { listPage } from "./list-page";

export const alertingRuleListPage = {
  shouldBeLoaded: () => {
    cy.log('alertingRuleListPage.shouldBeLoaded');
    listPage.filter.removeMainTag('Source');
    cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).contains('AR');
    cy.get(Classes.TableHeaderColumn).contains('Name').should('be.visible');
    cy.get(Classes.TableHeaderColumn).contains('Severity').should('be.visible');
    cy.get(Classes.TableHeaderColumn).contains('Alert state').should('be.visible');
    cy.get(Classes.TableHeaderColumn).contains('Source').should('be.visible');
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
      cy.byTestID(DataTestIDs.AlertingRuleResourceLink).contains(alertRule).should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error;
    }
  },

  countShouldBe: (count: number) => {
    cy.log('alertingRuleListPage.countShouldBe');
    cy.byTestID(DataTestIDs.AlertingRuleResourceLink).should('have.length', count);
  },

};
