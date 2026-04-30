import { commonPages } from './common';
import { DataTestIDs, Classes, FilterOUIAIDs } from '../../src/components/data-test';

export const silencesListPage = {
  shouldBeLoaded: () => {
    cy.log('silencesListPage.shouldBeLoaded');
    cy.byTestID(DataTestIDs.SilenceButton).should('be.visible');
    cy.byTestID(DataTestIDs.SilenceResourceIcon).contains('S');
    cy.get('table').find(Classes.TableHeaderColumn).contains('Name').should('be.visible');
    cy.get('table').find(Classes.TableHeaderColumn).contains('Firing alerts').should('be.visible');
    cy.get('table').find(Classes.TableHeaderColumn).contains('State').should('be.visible');
    cy.get('table').find(Classes.TableHeaderColumn).contains('Creator').should('be.visible');
  },

  firstTimeEmptyState: () => {
    cy.log('silencesListPage.firstTimeEmptyState');
    cy.byTestID(DataTestIDs.EmptyBoxBody).contains('No silences found').should('be.visible');
    cy.byOUIAID('DataViewToolbar-clear-all-filters').should('not.be.visible');
  },

  emptyState: () => {
    cy.log('silencesListPage.emptyState');
    cy.byTestID(DataTestIDs.EmptyBoxBody).contains('No silences found').should('be.visible');
    cy.byOUIAID('DataViewToolbar-clear-all-filters').should('be.visible');
    cy.get(Classes.IndividualTag)
      .contains('Active')
      .parent()
      .next('span')
      .children('button')
      .should('be.visible');
    cy.get(Classes.IndividualTag)
      .contains('Pending')
      .parent()
      .next('span')
      .children('button')
      .should('be.visible');
  },

  createSilence: () => {
    cy.log('silencesListPage.createSilence');
    cy.byTestID(DataTestIDs.SilenceButton).should('be.visible').click();
  },

  filter: {
    /**
     * @param name
     */
    byName: (name: string) => {
      cy.log('silencesListPage.filter.byName');
      try {
        cy.byOUIAID(`${FilterOUIAIDs.SilenceNameFilter}-input`)
          .find('input')
          .scrollIntoView()
          .as('input')
          .should('be.visible');
        cy.get('@input', { timeout: 10000 })
          .scrollIntoView()
          .type(name + '{enter}');
        cy.get('@input', { timeout: 10000 }).scrollIntoView().should('have.attr', 'value', name);
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
  },

  rows: {
    shouldBe: (alert: string, state: string) => {
      cy.log('silencesListPage.rows.shouldBe');
      cy.byOUIAID('DataViewToolbar-bulk-select').should('be.visible');
      cy.byTestID(DataTestIDs.SilenceResourceIcon).contains('S');
      cy.byTestID(DataTestIDs.SilenceResourceLink).contains(alert).should('be.visible');
      cy.get(Classes.SilenceState).eq(0).contains(state).should('be.visible');
    },

    clickSilencedAlert: (alert: string) => {
      cy.log('silencesListPage.rows.clickSilencedAlert');
      cy.byTestID(DataTestIDs.SilenceResourceLink).contains(alert).should('be.visible').click();
    },

    assertSilencedAlertKebab: () => {
      cy.log('silencesListPage.rows.assertSilencedAlertKebab');
      silencesListPage.rows.clickAlertKebab();
      cy.get(Classes.MenuItem).contains('Edit silence').should('be.visible');
      cy.get(Classes.MenuItem).contains('Expire silence').should('be.visible');
      // Close the kebab menu
      cy.byAriaLabel('Kebab toggle').first().click();
    },

    assertExpiredAlertKebab: (index: string) => {
      cy.log('silencesListPage.rows.assertExpiredAlertKebab');
      if (!index) {
        cy.byAriaLabel('Kebab toggle').should('be.visible').click();
      } else {
        cy.byAriaLabel('Kebab toggle').eq(Number(index)).should('be.visible').click();
      }
      cy.get(Classes.MenuItem).contains('Recreate silence').should('be.visible');
      // Close the kebab menu
      cy.byAriaLabel('Kebab toggle')
        .eq(Number(index) || 0)
        .click();
    },

    clickAlertKebab: () => {
      cy.log('silencesListPage.rows.clickAlertKebab');
      cy.wait(2000);
      cy.byAriaLabel('Kebab toggle').should('be.visible').click();
    },

    editSilence: () => {
      cy.log('silencesListPage.rows.editSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.get(Classes.MenuItem).contains('Edit silence').should('be.visible').click();
    },
    /**
     * * @param yes boolean: true to expire and false to cancel
     */
    expireSilence: (yes: boolean) => {
      cy.log('silencesListPage.rows.expireSilence');
      silencesListPage.rows.clickAlertKebab();
      cy.get(Classes.MenuItem).contains('Expire silence').should('be.visible').click();
      commonPages.confirmExpireAlert(yes);
    },
  },
};
