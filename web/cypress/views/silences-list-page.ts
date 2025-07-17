import { commonPages } from "./common";

export const silencesListPage = {

  shouldBeLoaded: () => {
    cy.log('silencesListPage.shouldBeLoaded');
    cy.byTestID('create-silence-btn').should('be.visible');
    cy.byClass('co-m-resource-icon co-m-resource-silence').contains('S');
    cy.byClass('pf-v6-c-table__button').contains('Name').should('be.visible');
    cy.byClass('pf-v6-c-table__button').contains('Firing alerts').should('be.visible');
    cy.byClass('pf-v6-c-table__button').contains('State').should('be.visible');
    cy.byClass('pf-v6-c-table__button').contains('Creator').should('be.visible');

  },
  firstTimeEmptyState: () => {
    cy.log('silencesListPage.firstTimeEmptyState');
    cy.byTestID('empty-box-body').contains('No Silences found').should('be.visible');
    cy.get(`[id="silences-content"]`).find('[class="pf-v6-c-button__text"]').contains('Clear all filters').should('not.exist');
  },

  emptyState: () => {
    cy.log('silencesListPage.emptyState');
    cy.byTestID('empty-box-body').contains('No Silences found').should('be.visible');
    cy.get(`[id="silences-content"]`).find('[class="pf-v6-c-button__text"]').contains('Clear all filters').should('be.visible');
    cy.get('[class="pf-v6-c-label-group__label"]').contains('Silence State').parent().next('div').children('button').should('be.visible');
    cy.get('[class="pf-v6-c-label__text"]').contains('Active').parent().next('span').children('button').should('be.visible');
    cy.get('[class="pf-v6-c-label__text"]').contains('Pending').parent().next('span').children('button').should('be.visible');

  },

  createSilence: () => {
    cy.byTestID('create-silence-btn').should('be.visible').click();
  },

  clickFilter: (toOpen: boolean, toClose: boolean) => {
    cy.log('silencesListPage.clickFilter');
    if (toOpen) {
      cy.byClass('pf-v6-c-menu-toggle').eq(2).should('be.visible').click();
      // cy.get(`[id="silences-content"]`).find('button[class="pf-v6-c-menu-toggle"]').as('filter').click();
    }
    if (toClose) {
      cy.byClass('pf-v6-c-menu-toggle pf-m-expanded').should('be.visible').click();
      // cy.get(`[id="silences-content"]`).find('button[class="pf-v6-c-menu-toggle pf-m-expanded"]').click();
    }
  },
  /**
   * 
   * @param open 
   * @param option 
   * @param close 
   */
  selectFilterOption: (open: boolean, option: string, close: boolean) => {
    cy.log('silencesListPage.selectFilterOption');
    if (open) {
      silencesListPage.clickFilter(open, false);
    };
    cy.byClass('co-filter-dropdown-item__name').contains(option).should('be.visible').click();
    if (close) {
      silencesListPage.clickFilter(false, close);
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

    clickSilencedAlert: (alert: string) => {
      cy.log('silencesListPage.rows.clickSilencedAlert');
      cy.byLegacyTestID('silence-resource-link').contains(alert).should('be.visible').click();
    },

    assertSilencedAlertKebab: () => {
      cy.log('silencesListPage.rows.assertSilencedAlertKebab');
      cy.get('[aria-label="kebab dropdown toggle"]').should('be.visible').click();
      cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible');
      cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible');

    },

    assertExpiredAlertKebab: (index: string) => {
      cy.log('silencesListPage.rows.assertExpiredAlertKebab');
      if (!index) {
        cy.get('[aria-label="kebab dropdown toggle"]').should('be.visible').click();
      } else {
        cy.get('[aria-label="kebab dropdown toggle"]').eq(Number(index)).should('be.visible').click();
      }

      cy.byClass('pf-v6-c-menu__item-text').contains('Recreate silence').should('be.visible');

    },

    clickAlertKebab: () => {
      cy.log('silencesListPage.rows.clickAlertKebab');
      cy.get('[aria-label="kebab dropdown toggle"]').should('be.visible').click();
    },

    editSilence: () => {
      cy.log('silencesListPage.rows.editSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible').click();

    },
    /**
     * * @param yes boolean: true to expire and false to cancel
     */
    expireSilence: (yes: boolean) => {
      cy.log('silencesListPage.rows.expireSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible').click();
      commonPages.confirmExpireAlert(yes);
    }
  },
}
