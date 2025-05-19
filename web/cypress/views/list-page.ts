export const listPage = {

  tableShoulBeLoaded: () => {
    cy.get('[id="silences-table-scroll"]').should('be.visible');
  },
 
  tabShouldHaveText: (tab: string) =>{
    cy.log('listPage.tabShouldHaveText');
    cy
    .byClass('pf-v6-c-tabs__item-text')
    .contains(tab)
    .should('exist');
  },

  filter: {
    /**
     * 
     * @param tab alerts-tab, silences, alerting-rules 
     * @param name 
     */
    byName: (tab: string, name: string) => {
      cy.log('listPage.filter.byName');
      cy.get(`[id="${tab}-content"]`).find('[data-test="name-filter-input"]')
        .should('be.visible');
      cy.wait(100);
      cy.get(`[id="${tab}-content"]`).find('[data-test="name-filter-input"]')
        .click()
        .type(name);
    },
    /**
     * 
     * @param tab alerts-tab, silences, alerting-rules 
     * @param label 
     */
    byLabel: (tab: string, label: string) => {
      cy.log('listPage.filter.byLabel');
      cy.byTestID('dropdown-button').click();
      cy.byTestID('dropdown-menu').contains('Label').click();
      cy.get(`[id="${tab}-content"]`).find('[data-test="name-filter-input"]')
      .should('be.visible')
      .type(label);
    },
    /**
     * 
     * @param tab alerts-tab, silences, alerting-rules 
     */
    clearAllFilters: (tab: string,) => {
      cy.log('listPage.clearAllFilters');
      cy.get(`[id="${tab}-content"]`).find('[class="pf-v6-c-button__text"]')
        .contains('Clear all filters')
        .should('be.visible');

        cy.get(`[id="${tab}-content"]`).find('[class="pf-v6-c-button__text"]')
        .contains('Clear all filters')
        .click();
        // cy
        //   .byClass('pf-v6-c-button__text')
        //   .eq(pos)
        //   .contains('Clear all filters')
        //   .click();
    }
  },
  ARRows: {
    shouldBeLoaded: () => {
      cy.log('listPage.ARRows.shouldBeLoaded');
      cy.byOUIAID('OUIA-Generated-Table').should('be.visible');
      // cy.get(`[data-test-rows="resource-row"`).should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.log('listPage.ARRows.countShouldBe');
      cy.byClass('pf-v6-c-table__tbody').should('have.length', count);
      // cy.get(`[data-test-rows="resource-row"`).should('have.length', count);
    },
    ARShouldBe: (alert: string, severity: string, total: number, state: string) => {
      cy.log('listPage.ARRows.ARShouldBe');
      cy.byOUIAID('OUIA-Generated-Button-plain').should('exist');
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR');
      cy.byClass('pf-v6-c-table__td').contains(alert).should('exist');
      cy.byClass('pf-v6-c-label__text').contains(severity).should('exist');
      cy.byClass('pf-v6-c-badge pf-m-read').contains(total).should('exist');
      cy.byClass('pf-v6-c-table__td').contains(state).should('exist');
    },
    AShouldBe: (alert: string, severity: string, namespace: string)  => {
      cy.log('listPage.ARRows.AShouldBe');
      cy.byClass('co-m-resource-icon co-m-resource-alert').should('exist');
      cy.byClass('pf-v6-l-flex pf-m-space-items-none pf-m-nowrap').contains(alert).should('exist');
      cy.byClass('pf-v6-c-label__text').contains(severity).should('exist');
      cy.byClass('co-resource-item__resource-name').contains(namespace).should('exist');
    },
    expandRow:() => {
      cy.log('listPage.ARRows.expandRow');
      cy.get('body').then( ($provider) => {
        if ($provider.find('button[class="pf-v6-c-button pf-m-plain pf-m-expanded"]').length > 0) {
            cy.log('Already expanded');
        } else{
            cy.get('button[class="pf-v6-c-button pf-m-plain"]').eq(2).click();
        }
      })
    },
    clickAlertingRule: () => {
      cy.log('listPage.ARRows.clickAlertingRule');
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR').parent().next().click();
    },
    clickAlert: () => {
      cy.log('listPage.ARRows.clickAlert');
      cy.get('[class="co-m-resource-icon co-m-resource-alert"]').parent().next('div').click();
    },
    clickAlertKebab: () => {
      cy.log('listPage.ARRows.clickAlertKebab');
      cy.byLegacyTestID('kebab-button').should('be.visible').click();
    },
    silenceAlert:() => {
      cy.log('listPage.ARRows.silentAlert');
      listPage.ARRows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Silence alert').should('be.visible').click();

    },
    editAlert:() => {
      cy.log('listPage.ARRows.silentAlert');
      listPage.ARRows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Edit alert').should('be.visible').click();

    },
    expireAlert:() => {
      cy.log('listPage.ARRows.silentAlert');
      listPage.ARRows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Expire alert').should('be.visible').click();

    }
  },
};
