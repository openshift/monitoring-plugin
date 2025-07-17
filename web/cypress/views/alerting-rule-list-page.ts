import { listPage } from "./list-page";

export const alertingRuleListPage = {
  shouldBeLoaded: () => {
    cy.log('alertingRuleListPage.shouldBeLoaded');
    // cy.get(`[id="alerting-rules-content"]`).find('pf-v6-c-label-group pf-m-category').contains('Source').should('be.visible');
    // cy.get(`[id="alerting-rules-content"]`).find('pf-v6-c-button__text').contains('Clear all filters').should('be.visible');
    listPage.filter.removeMainTag('alerting-rules','Source');
    cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR');
    cy.byClass('pf-v6-c-table__button').contains('Name').should('be.visible');
    cy.byClass('pf-v6-c-table__button').contains('Severity').should('be.visible');
    cy.byClass('pf-v6-c-table__button').contains('Alert state').should('be.visible');
    cy.byClass('pf-v6-c-table__button').contains('Source').should('be.visible');

  },

  tableShoulBeLoaded: () => {
    cy.log('alertingRuleListPage.tableShoulBeLoaded');
    cy.get('[id="alert-rules-table-scroll"]').should('be.visible');
  },

  tabShouldHaveText: (tab: string) => {
    cy.log('alertingRuleListPage.tabShouldHaveText');
    cy
      .byClass('pf-v6-c-tabs__item-text')
      .contains(tab)
      .should('exist');
  },

  filter: {

    clickFilter: (toOpen: boolean, toClose: boolean) => {
      cy.log('alertingRuleListPage.filter.clickFilter');
      if (toOpen) {
        cy.get(`[id="alerting-rules-content"]`).find('button[class="pf-v6-c-menu-toggle"]').eq(0).click();
      }
      if (toClose) {
        cy.get(`[id="alerting-rules-content"]`).find('button[class="pf-v6-c-menu-toggle pf-m-expanded"]').eq(0).click();
      }
    },
    /**
     * 
     * @param open 
     * @param option 
     * @param close 
     */
    selectFilterOption: (open: boolean, option: string, close: boolean) => {
      cy.log('alertingRuleListPage.filter.selectFilterOption');
      if (open) {
        alertingRuleListPage.filter.clickFilter(open, false);
      };
      cy.byClass('co-filter-dropdown-item__name').contains(option).should('be.visible').click();
      if (close) {
        alertingRuleListPage.filter.clickFilter(false, close);
      };
    },

    /**
    * 
    * @param tab alerts-tab, silences, alerting-rules 
    */
    assertNoClearAllFilters: () => {
      cy.log('alertingRuleListPage.filter.assertNoclearAllFilters');
      try {
        cy.get('.pf-v6-c-page__main-section > [data-test="filter-toolbar"] > :nth-child(2) > .pf-m-action-group-inline > .pf-v6-c-toolbar__item > .pf-v6-c-button > .pf-v6-c-button__text').should('not.exist');
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },

  },

  clickAlertingRule: (alertRule: string) => {
    cy.log('alertingRuleListPage.clickAlertingRule');
    try {
      cy.byClass('pf-v6-c-truncate__start').contains(alertRule).should('be.visible').click();
    } catch (error) {
      cy.log(`${error.message}`);
      throw error;
    }
  },

  countShouldBe: (count: number) => {
    cy.log('alertingRuleListPage.countShouldBe');
    cy.byClass('pf-v6-c-table__tr pf-v6-c-table__tr').should('have.length', count);
  },


};
