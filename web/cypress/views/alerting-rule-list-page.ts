import { DataTestIDs, Classes } from '../../src/components/data-test';
import { Source } from '../fixtures/monitoring/constants';
import { listPage } from './list-page';

export const alertingRuleListPage = {
  shouldBeLoaded: () => {
    cy.log('alertingRuleListPage.shouldBeLoaded');
    listPage.filter.removeIndividualTag(Source.PLATFORM);
    cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).contains('AR');
    cy.get(Classes.TableHeaderColumn).contains('Name').should('be.visible');
    cy.get(Classes.TableHeaderColumn).contains('Severity').should('be.visible');
    cy.get(Classes.TableHeaderColumn).contains('State').should('be.visible');
    cy.get(Classes.TableHeaderColumn).contains('Total').should('be.visible');
  },

  filter: {
    /**
     *
     * @param tab alerts-tab, silences, alerting-rules
     */
    assertNoClearAllFilters: () => {
      cy.log('alertingRuleListPage.filter.assertNoclearAllFilters');
      try {
        cy.byOUIAID('DataViewToolbar-clear-all-filters').should('not.be.visible');
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
  },

  clickAlertingRule: (alertRule: string) => {
    cy.log('alertingRuleListPage.clickAlertingRule');
    try {
      cy.byTestID(DataTestIDs.AlertingRuleResourceLink)
        .contains(alertRule)
        .should('be.visible')
        .click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error;
    }
  },

  countShouldBe: (count: number) => {
    cy.log('alertingRuleListPage.countShouldBe');
    cy.byTestID(DataTestIDs.AlertingRuleResourceLink).should('have.length', count);
  },

  ARShouldBe: (alert: string, severity: string, total: number, state: string) => {
    cy.log('alertingRuleListPage.ARShouldBe');
    cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).contains('AR');
    cy.byTestID(DataTestIDs.AlertingRuleResourceLink).contains(alert).should('exist');
    cy.byTestID(DataTestIDs.SeverityBadge).contains(severity).should('exist');
    cy.byTestID(DataTestIDs.AlertingRuleStateBadge).contains(total).should('exist');
    cy.byTestID(DataTestIDs.AlertingRuleStateBadge).contains(state).should('exist');
  },
  emptyState: () => {
    cy.log('alertingRuleListPage.emptyState');
    cy.byTestID(DataTestIDs.EmptyBoxBody).contains('No alerting rules found').should('be.visible');
    cy.byOUIAID('DataViewToolbar-clear-all-filters').should('not.be.visible');
  },
};
