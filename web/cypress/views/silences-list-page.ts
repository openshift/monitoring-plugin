import { commonPages } from "./common";
import { DataTestIDs, Classes, LegacyTestIDs } from "../../src/components/data-test";

export const silencesListPage = {

  shouldBeLoaded: () => {
    cy.log('silencesListPage.shouldBeLoaded');
    cy.byTestID(DataTestIDs.CreateSilenceButton).should('be.visible');
    cy.get(Classes.SilenceResourceIcon).contains('SL');
    cy.get('table').find(Classes.TableHeaderColumn).contains('Name').should('be.visible');
    cy.get('table').find(Classes.TableHeaderColumn).contains('Firing alerts').should('be.visible');
    cy.get('table').find(Classes.TableHeaderColumn).contains('State').should('be.visible');
    cy.get('table').find(Classes.TableHeaderColumn).contains('Creator').should('be.visible');

  },
  firstTimeEmptyState: () => {
    cy.log('silencesListPage.firstTimeEmptyState');
    cy.byTestID(DataTestIDs.EmptyBoxBody).contains('No silences found').should('be.visible');
    cy.bySemanticElement('button', 'Clear all filters').should('not.exist');
  },

  emptyState: () => {
    cy.log('silencesListPage.emptyState');
    cy.byTestID(DataTestIDs.EmptyBoxBody).contains('No Silences found').should('be.visible');
    cy.bySemanticElement('button', 'Clear all filters').should('be.visible');
    cy.get(Classes.MainTag).contains('Silence State').parent().next('div').children('button').should('be.visible');
    cy.get(Classes.IndividualTag).contains('Active').parent().next('span').children('button').should('be.visible');
    cy.get(Classes.IndividualTag).contains('Pending').parent().next('span').children('button').should('be.visible'); 

  },

  createSilence: () => {
    cy.log('silencesListPage.createSilence');
    // cy.byTestID(DataTestIDs.SilenceButton).should('be.visible').click();
    cy.bySemanticElement('button', 'Create silence').should('be.visible').click();
  },

  

  filter: {
    /**
     * @param name 
     */
    byName: (name: string) => {
      cy.log('silencesListPage.filter.byName');
      try {
          cy.byTestID(DataTestIDs.NameInput).scrollIntoView().as('input').should('be.visible');
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
    shouldBe: (alert: string, state: string) => {
      cy.log('silencesListPage.rows.shouldBe');
      cy.get('#'+LegacyTestIDs.SelectAllSilencesCheckbox).should('be.visible');
      cy.get(Classes.SilenceResourceIcon).contains('SL');
      cy.byLegacyTestID(LegacyTestIDs.SilenceResourceLink).contains(alert).should('be.visible');
      cy.get(Classes.SilenceState).eq(0).contains(state).should('be.visible');
    },

    clickSilencedAlert: (alert: string) => {
      cy.log('silencesListPage.rows.clickSilencedAlert');
      cy.byLegacyTestID(LegacyTestIDs.SilenceResourceLink).contains(alert).should('be.visible').click();
    },

    assertSilencedAlertKebab: () => {
      cy.log('silencesListPage.rows.assertSilencedAlertKebab');
      silencesListPage.rows.clickAlertKebab();
      cy.byPFRole('menuitem').contains('Edit silence').should('be.visible');
      cy.byPFRole('menuitem').contains('Expire silence').should('be.visible');
    },

    assertExpiredAlertKebab: (index: string) => {
      cy.log('silencesListPage.rows.assertExpiredAlertKebab');
      if (!index) {
        cy.byTestID(DataTestIDs.SilenceKebabDropdown).should('be.visible').click();
      } else {
        cy.byTestID(DataTestIDs.SilenceKebabDropdown).eq(Number(index)).scrollIntoView().should('be.visible').click();
      }
      cy.byPFRole('menuitem').contains('Recreate silence').should('be.visible');
    },

    clickAlertKebab: () => {
      cy.log('silencesListPage.rows.clickAlertKebab');
      cy.wait(2000);
      cy.byTestID(DataTestIDs.SilenceKebabDropdown).should('be.visible').click();
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
