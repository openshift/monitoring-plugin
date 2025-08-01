import { commonPages } from "./common";

export const silencesListPage = {

  shouldBeLoaded: () => {
    cy.log('silencesListPage.shouldBeLoaded');
    cy.bySemanticElement('button','Create silence').should('be.visible');
    cy.byClass('co-m-resource-icon co-m-resource-silence').contains('S');
    cy.bySemanticElement('button', 'Name').should('be.visible');
    cy.bySemanticElement('button', 'Firing alerts').should('be.visible');
    cy.bySemanticElement('button', 'State').should('be.visible');
    cy.bySemanticElement('button', 'Creator').should('be.visible');

  },
  firstTimeEmptyState: () => {
    cy.log('silencesListPage.firstTimeEmptyState');
    cy.byTestID('empty-box-body').contains('No Silences found').should('be.visible');
    cy.bySemanticElement('button', 'Clear all filters').should('not.exist');
  },

  emptyState: () => {
    cy.log('silencesListPage.emptyState');
    cy.byTestID('empty-box-body').contains('No Silences found').should('be.visible');
    cy.bySemanticElement('button', 'Clear all filters').should('be.visible');
    cy.get('.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label').contains('Silence State').parent().next('div').children('button').should('be.visible');
    cy.get('.pf-v6-c-label__text, .pf-v5-c-chip__text').contains('Active').parent().next('span').children('button').should('be.visible');
    cy.get('.pf-v6-c-label__text, .pf-v5-c-chip__text').contains('Pending').parent().next('span').children('button').should('be.visible'); 

  },

  createSilence: () => {
    cy.log('silencesListPage.createSilence');
    cy.bySemanticElement('button').contains('Create silence').should('be.visible').click();
  },

  

  filter: {
    /**
     * @param name 
     */
    byName: (name: string) => {
      cy.log('silencesListPage.filter.byName');
      try {
          cy.byTestID('name-filter-input').scrollIntoView().as('input').should('be.visible');
          cy.get('@input', { timeout: 10000 }).scrollIntoView().type(name + '{enter}');
          cy.get('@input', { timeout: 10000 }).scrollIntoView().should('have.attr', 'value', name);
        
      }
      catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
  },

  rows: {
    shouldBeLoaded: () => {
      cy.log('silencesListPage.rows.shouldBeLoaded');
      cy.get('.loading-box.loading-box__loaded').should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.log('silencesListPage.rows.countShouldBe');
      cy.get('.ReactVirtualized__VirtualGrid__innerScrollContainer.pf-v6-c-table__tbody, .ReactVirtualized__VirtualGrid__innerScrollContainer.pf-v5-c-table__tbody').should('have.length', count);
      // cy.get(`[data-test-rows="resource-row"`).should('have.length', count);
    },
    SShouldBe: (alert: string, state: string) => {
      cy.log('silencesListPage.rows.SShouldBe');
      cy.get('.pf-v6-c-check.pf-m-standalone, .pf-v5-c-check.pf-m-standalone').should('be.visible');
      cy.byClass('co-m-resource-icon co-m-resource-silence').contains('S');
      cy.byLegacyTestID('silence-resource-link').contains(alert).should('be.visible');
      cy.get('.pf-v6-l-stack__item, .co-break-word').eq(0).contains(state).should('be.visible');
    },

    clickSilencedAlert: (alert: string) => {
      cy.log('silencesListPage.rows.clickSilencedAlert');
      cy.byLegacyTestID('silence-resource-link').contains(alert).should('be.visible').click();
    },

    assertSilencedAlertKebab: () => {
      cy.log('silencesListPage.rows.assertSilencedAlertKebab');
      cy.get('table').find('.pf-v6-c-menu-toggle.pf-m-plain, .pf-v5-c-dropdown__toggle.pf-m-plain').should('be.visible').click();
      cy.byPFRole('menuitem').contains('Edit silence').should('be.visible');
      cy.byPFRole('menuitem').contains('Expire silence').should('be.visible');
    },

    assertExpiredAlertKebab: (index: string) => {
      cy.log('silencesListPage.rows.assertExpiredAlertKebab');
      if (!index) {
        cy.get('table').find('.pf-v6-c-menu-toggle.pf-m-plain, .pf-v5-c-dropdown__toggle.pf-m-plain').should('be.visible').click();
      } else {
        cy.get('table').find('.pf-v6-c-menu-toggle.pf-m-plain, .pf-v5-c-dropdown__toggle.pf-m-plain').eq(Number(index)).should('be.visible').click();
      }
      cy.byPFRole('menuitem').contains('Recreate silence').should('be.visible');
    },

    clickAlertKebab: () => {
      cy.log('silencesListPage.rows.clickAlertKebab');
      cy.get('table').find('.pf-v6-c-menu-toggle.pf-m-plain, .pf-v5-c-dropdown__toggle.pf-m-plain').should('be.visible').click();
    },

    editSilence: () => {
      cy.log('silencesListPage.rows.editSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.byPFRole('menuitem').contains('Edit silence').should('be.visible').click();

    },
    /**
     * * @param yes boolean: true to expire and false to cancel
     */
    expireSilence: (yes: boolean) => {
      cy.log('silencesListPage.rows.expireSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.byPFRole('menuitem').contains('Expire silence').should('be.visible').click();
      commonPages.confirmExpireAlert(yes);
    }
  },
}
