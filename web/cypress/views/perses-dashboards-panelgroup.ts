import { commonPages } from "./common";
import { persesAriaLabels, persesMUIDataTestIDs, IDs } from "../../src/components/data-test";
import { persesDashboardsModalTitles, persesDashboardsRequiredFields } from "../fixtures/perses/constants";

export const persesDashboardsPanelGroup = {

  addPanelGroupShouldBeLoaded: () => {
    cy.log('persesDashboardsPanelGroup.addPanelGroupShouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.ADD_PANEL_GROUP);
    cy.byDataTestID(persesMUIDataTestIDs.addPanelGroupFormName).should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).find('input').eq(1).should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).find('input').eq(2).should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).parent('div').siblings('div').find('button').contains('Apply').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).parent('div').siblings('div').find('button').contains('Cancel').should('be.visible');
  },

  clickButton: (button: 'Add' | 'Cancel') => {
    cy.log('persesDashboardsPanelGroup.clickButton');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).parent('div').siblings('div').find('button').contains(button).should('be.visible').click();
  },

  assertRequiredFieldValidation: (field: string) => {
    cy.log('persesDashboardsPanelGroup.assertRequiredFieldValidation');

    switch (field) {
      case 'Name':
        cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('label').contains(field).siblings('p').should('have.text', persesDashboardsRequiredFields.AddVariableNameField);
        break;
    }
  },

  addPanelGroup: (name: string, collapse_state: 'Open' | 'Closed', repeat_variable: string) => {
    cy.log('persesDashboardsPanelGroup.addPanelGroup');
    cy.wait(2000);
    cy.byDataTestID(persesMUIDataTestIDs.addPanelGroupFormName).find('input').clear().type(name);
    cy.byPFRole('dialog').find('div[role="combobox"]').eq(0).click();
    cy.byPFRole('option').contains(collapse_state).click();
    if (repeat_variable !== undefined && repeat_variable !== '') {
      cy.byPFRole('dialog').find('div[role="combobox"]').eq(1).click();
      cy.byPFRole('option').contains(repeat_variable).click();
    }
    cy.byPFRole('dialog').find('button').contains('Add').should('be.visible').click({ force: true });
  },

  editPanelGroupShouldBeLoaded: () => {
    cy.log('persesDashboardsPanelGroup.editPanelGroupShouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.EDIT_PANEL_GROUP);
    cy.byDataTestID(persesMUIDataTestIDs.addPanelGroupFormName).should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).find('input').eq(1).should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).find('input').eq(2).should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).parent('div').siblings('div').find('button').contains('Apply').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelGroupForm).parent('div').siblings('div').find('button').contains('Cancel').should('be.visible');
  },

  editPanelGroup: (name: string, collapse_state: 'Open' | 'Closed', repeat_variable: string) => {
    cy.log('persesDashboardsPanelGroup.editPanelGroup');
    cy.byDataTestID(persesMUIDataTestIDs.addPanelGroupFormName).find('input').clear().type(name);
    cy.byPFRole('dialog').find('div[role="combobox"]').eq(0).click();
    cy.byPFRole('option').contains(collapse_state).click();
    if (repeat_variable !== undefined && repeat_variable !== '') {
      cy.byPFRole('dialog').find('div[role="combobox"]').eq(1).click();
      cy.byPFRole('option').contains(repeat_variable).click();
    }
    cy.bySemanticElement('button', 'Apply').should('be.visible').click();
  },

  clickPanelGroupAction: (panelGroup: string, button: 'addPanel' | 'edit' | 'delete' | 'moveDown' | 'moveUp') => {
    cy.log('persesDashboardsPage.clickPanelActions');

    switch (button) {
      case 'addPanel':
        cy.byAriaLabel(persesAriaLabels.AddPanelToGroupPrefix + panelGroup).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'edit':
        cy.byAriaLabel(persesAriaLabels.EditPanelGroupPrefix + panelGroup).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'delete':
        cy.byAriaLabel(persesAriaLabels.DeletePanelGroupPrefix + panelGroup).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'moveDown':
        cy.byAriaLabel(persesAriaLabels.MovePanelGroupPrefix + panelGroup + persesAriaLabels.MovePanelGroupDownSuffix).scrollIntoView().should('be.visible').click({ force: true });
        break;
      case 'moveUp':
        cy.byAriaLabel(persesAriaLabels.MovePanelGroupPrefix + panelGroup + persesAriaLabels.MovePanelGroupUpSuffix).scrollIntoView().should('be.visible').click({ force: true });
        break;
    }

  },

  clickDeletePanelGroupButton: () => {
    cy.log('persesDashboardsPage.clickDeletePanelGroupButton');
    cy.bySemanticElement('button', 'Delete').scrollIntoView().should('be.visible').click({ force: true });
  },


}