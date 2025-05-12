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
    cy.byTestID('firing-alerts')
      .first()
      .should('have.text', alertname)
      .click();

  }


};
