export const silencesListPage = {

  shouldBeLoaded: () => {
    cy.log('silencesListPage.shouldBeLoaded');
    cy.byTestID('create-silence-btn')
      .should('be.visible');

  },
  emptyState:() => {
    cy.byTestID('empty-box-body')
      .contains('No Silences found')
      .should('be.visible');
  },

  clickFilter:(toOpen: boolean)=>{
      cy.log('silencesListPage.clickFilter');
      if (toOpen){
        cy.get('[class="pf-v6-c-menu-toggle"]', { timeout: 10000 }).eq(2).click().should('have.class', 'pf-v6-c-menu-toggle pf-m-expanded');
      }else{
        cy.get('[class="pf-v6-c-menu-toggle"]', { timeout: 10000 }).eq(2).click().should('not.have.class', 'pf-m-expanded');
      }
    },
    /**
     * 
     * @param open true = open, false = nothing
     * @param option 
     * @returns 
     */
    selectFilterOption:(open: boolean, option: string, close: boolean)=> {
      cy.log('silencesListPage.selectFilterOption');
      if (open){
        silencesListPage.clickFilter(open);
      };
      cy.byClass('co-filter-dropdown-item__name').contains(option).click();
      if (close){
        silencesListPage.clickFilter(false);
      };
    },

  rows: {
    shouldBeLoaded: () => {
      cy.log('silencesListPage.rows.shouldBeLoaded');
      cy.byClass('loading-box loading-box__loaded').should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.log('silencesListPage.rows.countShouldBe');
      cy.byClass('pf-v6-c-table__tbody').should('have.length', count);
      // cy.get(`[data-test-rows="resource-row"`).should('have.length', count);
    },
    SShouldBe: (alert: string, state: string) => {
      cy.log('silencesListPage.rows.SShouldBe');
      cy.byClass('pf-v6-c-check pf-m-standalone').should('be.visible');
      cy.byClass('co-m-resource-icon co-m-resource-silence').contains('S');
      cy.byLegacyTestID('silence-resource-link').contains(alert).should('be.visible');
      cy.byClass('pf-v6-l-stack__item').eq(0).contains(state).should('be.visible');
    },
    expandRow:() => {
      cy.log('silencesListPage.rows.expandRow');
      cy.get('body').then( ($provider) => {
        if ($provider.find('button[class="pf-v6-c-button pf-m-plain pf-m-expanded"]').length > 0) {
            cy.log('Already expanded');
        } else{
            cy.get('button[class="pf-v6-c-button pf-m-plain"]').eq(2).click();
        }
      })
    },
    
    clickAlertKebab: () => {
      cy.log('silencesListPage.rows.clickAlertKebab');
      cy.get('[aria-label="kebab dropdown toggle"]').should('be.visible').click();
    },
    editSilence:() => {
      cy.log('silencesListPage.rows.editSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible').click();

    },
    /**
     * * @param yes boolean: true to expire and false to cancel
     */
    expireSilence:(yes: boolean) => {
      cy.log('silencesListPage.rows.expireSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible').click();
      if (yes) {
        cy.byClass('pf-v6-c-button pf-m-primary pf-m-progress').should('be.visible').click();
      } else {
        cy.byClass('pf-v6-c-button pf-m-secondary').should('be.visible').click();
      };
    }
  },
}
