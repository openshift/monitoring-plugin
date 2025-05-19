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
      try {
        cy.get(`[id="${tab}-content"]`).find('input[data-test="name-filter-input"]')
        .as('input').should('be.visible');
        cy.get('@input', { timeout: 10000 }).type(name + '{enter}').should('have.attr', 'value', name);
      }
      catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
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
      cy.log('listPage.filter.clearAllFilters');
      cy.get(`[id="${tab}-content"]`).find('[class="pf-v6-c-button__text"]')
        .contains('Clear all filters')
        .should('be.visible');
      try {
        cy.get(`[id="${tab}-content"]`).find('[class="pf-v6-c-button__text"]')
          .contains('Clear all filters')
          .click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    },
    clickFilter:(toOpen: boolean)=>{
      cy.log('listPage.filter.clickFilter');
      if (toOpen){
        cy.byClass('pf-v6-c-menu-toggle').eq(0).click().should('have.class', 'pf-v6-c-menu-toggle pf-m-expanded');
      }else{
        cy.byClass('pf-v6-c-menu-toggle').eq(0).click().should('not.have.class', 'pf-m-expanded');
      }
    },
    /**
     * 
     * @param open true = open, false = nothing
     * @param option 
     * @returns 
     */
    selectFilterOption:(open: boolean, option: string, close: boolean)=> {
      cy.log('listPage.filter.selectFilterOption');
      if (open){
        listPage.filter.clickFilter(open);
      };
      cy.byClass('co-filter-dropdown-item__name').contains(option).click();
      if (close){
        listPage.filter.clickFilter(false);
      };
    },
      
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
      try {
          cy.get('body').then( ($provider) => {
          if ($provider.find('button[class="pf-v6-c-button pf-m-plain pf-m-expanded"]').length > 0) {
              cy.log('Already expanded');
          } else{
              cy.get('button[class="pf-v6-c-button pf-m-plain"]', { timeout: 10000 })
              .eq(2)
              .click()
              .should('have.class', 'pf-m-expanded');
          }
        })
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    },
    clickAlertingRule: () => {
      cy.log('listPage.ARRows.clickAlertingRule');
      try {
          cy.byClass('co-m-resource-icon co-m-resource-alertrule')
            .contains('AR')
            .parent()
            .next()
            .should('be.visible')
            .click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
     
    },
    clickAlert: () => {
      cy.log('listPage.ARRows.clickAlert');
      try {
      cy.get('[class="co-m-resource-icon co-m-resource-alert"]')
        .parent()
        .next('div')
        .click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
      
    },
    clickAlertKebab: () => {
      cy.log('listPage.ARRows.clickAlertKebab');
      try {
        cy.byLegacyTestID('kebab-button').should('be.visible').click();
      }catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    },
    silenceAlert:() => {
      cy.log('listPage.ARRows.silentAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byClass('pf-v6-c-menu__item-text').contains('Silence alert').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
      

    },
    editAlert:() => {
      cy.log('listPage.ARRows.silentAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byClass('pf-v6-c-menu__item-text').contains('Edit alert').should('be.visible').click();
      }catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    },
    expireAlert:() => {
      cy.log('listPage.ARRows.silentAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byClass('pf-v6-c-menu__item-text').contains('Expire alert').should('be.visible').click();
      }catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
    }
  },
};
