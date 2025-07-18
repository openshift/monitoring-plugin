import { commonPages } from "./common";
import { detailsPage } from "./details-page";

export const silenceDetailsPage = {

  assertSilenceDetailsPage: (title: string, section: string, labelname: string) => {
    cy.log('silenceDetailsPage.assertSilenceDetailsPage');
    commonPages.titleShouldHaveText(title);
    detailsPage.sectionHeaderShouldExist(section);
    detailsPage.labelShouldExist(labelname);
  },

  clickOnFiringAlerts: (alertname: string) => {
    cy.log('silenceDetailsPage.clickOnFiringAlerts');
    cy.byTestID('firing-alerts')
      .first()
      .should('have.text', alertname)
      .click();
  },

  clickActions: (toOpen: boolean) => {
    cy.log('silenceDetailsPage.clickActions');
    if (toOpen) {
      cy.byClass('pf-v6-c-menu-toggle').eq(0).click();
    }
  },

  assertActionsExpiredAlert: () => {
    cy.log('silenceDetailsPage.assertActionsExpiredAlert');
    silenceDetailsPage.clickActions(true);
    cy.byClass('pf-v6-c-menu__item-text').contains('Recreate silence').should('be.visible');
  },

  assertActionsSilencedAlert: () => {
    cy.log('silenceDetailsPage.assertActionsExpiredAlert');
    silenceDetailsPage.clickActions(true);
    cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible');
    cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible');
  },

  editSilence: (toOpen: boolean) => {
    cy.log('silenceDetailsPage.editSilence');
    silenceDetailsPage.clickActions(toOpen);
    cy.byClass('pf-v6-c-menu__item-text').contains('Edit silence').should('be.visible').click();
  },

  /**
   * 
   * @param toOpen true: to open Actions dropdown, false: assuming it is already opened
   * @param yes true: confirm, false: cancel
   */
  expireSilence: (toOpen: boolean, yes: boolean) => {
    cy.log('silenceDetailsPage.expireSilence');
    silenceDetailsPage.clickActions(toOpen);
    cy.byClass('pf-v6-c-menu__item-text').contains('Expire silence').should('be.visible').click();
    commonPages.confirmExpireAlert(yes);
  },

  recreateSilence: (toOpen: boolean) => {
    cy.log('silenceDetailsPage.recreateSilence');
    silenceDetailsPage.clickActions(toOpen);
    cy.byClass('pf-v6-c-menu__item-text').contains('Recreate silence').should('be.visible').click();
  },

  clickSilencesBreadcrumb:() => {
    cy.log('silenceDetailsPage.clickSilencesBreadcrumb');
     try {
       cy.get('pf-v6-c-breadcrumb__item').contains('Silences').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
  }
};
