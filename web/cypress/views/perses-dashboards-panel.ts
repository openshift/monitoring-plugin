import { commonPages } from "./common";
import { persesAriaLabels, persesMUIDataTestIDs, IDs, editPersesDashboardsAddPanel } from "../../src/components/data-test";
import { persesDashboardsModalTitles, persesDashboardsRequiredFields, persesDashboardsAddListPanelType } from "../fixtures/perses/constants";

export const persesDashboardsPanel = {

  addPanelShouldBeLoaded: () => {
    cy.log('persesDashboardsPanel.addPanelShouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.ADD_PANEL);
    cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelForm).find('label').contains('Group').should('be.visible');
    cy.get('input[name="'+editPersesDashboardsAddPanel.inputDescription+'"]').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelForm).find('label').contains('Type').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains('Add').should('be.visible').and('have.attr', 'disabled');
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains('Cancel').should('be.visible');

  },

  clickButton: (button: 'Add' | 'Cancel') => {
    cy.log('persesDashboardsPanel.clickButton');
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains(button).should('be.visible').click();
  },

  clickDropdownAndSelectOption: (label: string, option: string | keyof typeof persesDashboardsAddListPanelType) => {
    cy.log('persesDashboardsPanel.clickDropdownAndSelectOption');
    cy.get('#'+IDs.persesDashboardAddPanelForm).find('label').contains(label).siblings('div').click();
    cy.get('li').contains(option).should('be.visible').click();
  },

  assertRequiredFieldValidation: (field: string) => {
    cy.log('persesDashboardsPanel.assertRequiredFieldValidation');

    switch (field) {
      case 'Name':
        cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('label').contains(field).siblings('p').should('have.text', persesDashboardsRequiredFields.AddVariableNameField);
        break;
    }
  },

  addPanel: (name: string, group: string, type: keyof typeof persesDashboardsAddListPanelType, description?: string) => {
    cy.log('persesDashboardsPanel.addPanel');
    cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').clear().type(name);
    if (description !== undefined && description !== '') {
      cy.get('input[name="'+editPersesDashboardsAddPanel.inputDescription+'"]').clear().type(description);
    }
    persesDashboardsPanel.clickDropdownAndSelectOption('Group', group);
    persesDashboardsPanel.clickDropdownAndSelectOption('Type', type);
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains('Add').should('be.visible').click();
  },

  editPanelShouldBeLoaded: () => {
    cy.log('persesDashboardsPanel.editPanelShouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.ADD_PANEL);
    cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelForm).find('label').contains('Group').should('be.visible');
    cy.get('input[name="'+editPersesDashboardsAddPanel.inputDescription+'"]').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelForm).find('label').contains('Type').should('be.visible');
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains('Apply').should('be.visible').and('have.attr', 'disabled');
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains('Cancel').should('be.visible');

  },

  editPanel: (name: string, group: string, type: keyof typeof persesDashboardsAddListPanelType, description?: string) => {
    cy.log('persesDashboardsPanel.editPanel');
    cy.get('input[name="'+editPersesDashboardsAddPanel.inputName+'"]').clear().type(name);
    if (description !== undefined && description !== '') {
      cy.get('input[name="'+editPersesDashboardsAddPanel.inputDescription+'"]').clear().type(description);
    }
    persesDashboardsPanel.clickDropdownAndSelectOption('Group', group);
    persesDashboardsPanel.clickDropdownAndSelectOption('Type', type);
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').siblings('div').find('button').contains('Apply').should('be.visible').click();
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