import { Classes, IDs } from "../../src/components/data-test";
import { persesCreateDashboard, persesDashboardsModalTitles } from "../fixtures/perses/constants";

export const persesCreateDashboardsPage = {

  createDashboardShouldBeLoaded: () => {
    cy.log('persesCreateDashboardsPage.createDashboardShouldBeLoaded');
    cy.byPFRole('dialog').find('h1').should('have.text', persesDashboardsModalTitles.CREATE_DASHBOARD);
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible');
    cy.get('#' + IDs.persesDashboardCreateDashboardName).should('be.visible');
    cy.byPFRole('dialog').find('button').contains('Create').should('be.visible');
    cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible');
  },

  selectProject: (project: string) => {
    cy.log('persesCreateDashboardsPage.selectProject');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('menuitem').contains(project).should('be.visible').click({ force: true });
  },
  
  assertProjectDropdown: (project: string) => {
    cy.log('persesCreateDashboardsPage.assertProjectDropdown');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('menuitem').contains(project).should('be.visible');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
  },

  assertProjectNotExistsInDropdown: (project: string) => {
    cy.log('persesCreateDashboardsPage.assertProjectNotExistsInDropdown');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('menu').find('li').then((items) => {
      items.each((index, item) => {
        cy.log('Project: ' + item.innerText);
        if (item.innerText === project) {
          expect(item).to.not.exist;
        }
      });
    });
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
  },

  enterDashboardName: (name: string) => {
    cy.log('persesCreateDashboardsPage.enterDashboardName');
    cy.get('#' + IDs.persesDashboardCreateDashboardName).should('be.visible').clear().type(name);
  },

  createDashboardDialogCreateButton: () => {
    cy.log('persesCreateDashboardsPage.clickCreateButton');
    cy.byPFRole('dialog').find('button').contains('Create').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertMaxLengthValidation: () => {
    cy.log('persesCreateDashboardsPage.assertMaxLengthValidation');
    cy.byPFRole('dialog').find('h4').should('have.text', persesCreateDashboard.DIALOG_MAX_LENGTH_VALIDATION).should('be.visible');
  },

  assertDuplicatedNameValidation: (dashboardName: string) => {
    cy.log('persesCreateDashboardsPage.assertDuplicatedNameValidation');
    if (dashboardName.includes(' ')) {
      cy.byPFRole('dialog').find('h4').should('have.text', persesCreateDashboard.DIALOG_DUPLICATED_NAME_BKD_VALIDATION).should('be.visible');
    } else {
      cy.byPFRole('dialog').find(Classes.PersesCreateDashboardDashboardNameError).should('have.text', `${persesCreateDashboard.DIALOG_DUPLICATED_NAME_PF_VALIDATION_PREFIX}"${dashboardName}"${persesCreateDashboard.DIALOG_DUPLICATED_NAME_PF_VALIDATION_SUFFIX}`).should('be.visible');
    }
  },

}
