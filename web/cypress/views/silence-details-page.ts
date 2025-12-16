import { commonPages } from "./common";
import { detailsPage } from "./details-page";
import { DataTestIDs } from "../../src/components/data-test";

export const silenceDetailsPage = {

  assertSilenceDetailsPage: (title: string, section: string, labelname: string) => {
    cy.log('silenceDetailsPage.assertSilenceDetailsPage');
    commonPages.titleShouldHaveText(title);
    detailsPage.sectionHeaderShouldExist(section);
    detailsPage.labelShouldExist(labelname);
  },

  clickOnFiringAlerts: (alertname: string) => {
    cy.log('silenceDetailsPage.clickOnFiringAlerts');
    cy.byTestID(DataTestIDs.AlertResourceLink)
      .first()
      .scrollIntoView()
      .should('have.text', alertname)
      .click();
  },

  clickActions: (toOpen: boolean) => {
    cy.log('silenceDetailsPage.clickActions');
    if (toOpen) {
      cy.byTestID(DataTestIDs.KebabDropdownButton).contains('Actions').click();
    }
  },

  assertActionsExpiredAlert: () => {
    cy.log('silenceDetailsPage.assertActionsExpiredAlert');
    silenceDetailsPage.clickActions(true);
    cy.byTestID(DataTestIDs.SilenceRecreateDropdownItem).should('be.visible');
  },

  assertActionsSilencedAlert: () => {
    cy.log('silenceDetailsPage.assertActionsExpiredAlert');
    silenceDetailsPage.clickActions(true);
    cy.byTestID(DataTestIDs.SilenceEditDropdownItem).should('be.visible');
    cy.byTestID(DataTestIDs.SilenceExpireDropdownItem).should('be.visible');
  },

  editSilence: (toOpen: boolean) => {
    cy.log('silenceDetailsPage.editSilence');
    silenceDetailsPage.clickActions(toOpen);
    cy.byTestID(DataTestIDs.SilenceEditDropdownItem).should('be.visible').click();
  },

  /**
   * 
   * @param toOpen true: to open Actions dropdown, false: assuming it is already opened
   * @param yes true: confirm, false: cancel
   */
  expireSilence: (toOpen: boolean, yes: boolean) => {
    cy.log('silenceDetailsPage.expireSilence');
    silenceDetailsPage.clickActions(toOpen);
    cy.byTestID(DataTestIDs.SilenceExpireDropdownItem).should('be.visible').click();
    commonPages.confirmExpireAlert(yes);
  },

  recreateSilence: (toOpen: boolean) => {
    cy.log('silenceDetailsPage.recreateSilence');
    silenceDetailsPage.clickActions(toOpen);
    cy.byTestID(DataTestIDs.SilenceRecreateDropdownItem).should('be.visible').click();
  },

  clickSilencesBreadcrumb:() => {
    cy.log('silenceDetailsPage.clickSilencesBreadcrumb');
     try {
       cy.byTestID(DataTestIDs.Breadcrumb).contains('Silences').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error; 
      }
  }
};
