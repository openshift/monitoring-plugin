import { commonPages } from "./common";
import { persesAriaLabels, persesMUIDataTestIDs, IDs, editPersesDashboardsAddVariable } from "../../src/components/data-test";
import { persesDashboardsModalTitles, persesDashboardsAddListVariableSource, persesDashboardsAddListVariableSort } from "../fixtures/perses/constants";

export const persesDashboardsEditVariables = {

  shouldBeLoaded: () => {
    cy.log('persesDashboardsEditVariables.shouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.EDIT_DASHBOARD_VARIABLES);
    cy.byAriaLabel(persesAriaLabels.EditDashboardVariablesTable).should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains('Apply').should('be.visible').and('have.attr', 'disabled');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains('Cancel').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains('Add Variable').should('be.visible');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.DASHBOARD_BUILT_IN_VARIABLES);
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('#'+IDs.persesDashboardEditVariablesModalBuiltinButton).should('have.attr', 'aria-expanded', 'false');
  },

  clickButton: (button: 'Apply' | 'Cancel' | 'Add Variable' | 'Add') => {
    cy.log('persesDashboardsEditVariables.clickButton');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains(button).should('be.visible').click();
  },

  addTextVariable: (name: string, constant: boolean, displayLabel?: string, description?: string, value?: string) => {
    cy.log('persesDashboardsEditVariables.addVariable');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains('Add Variable').should('be.visible').click();
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputName+'"]').type(name);
    
    const displayLabelInput = displayLabel !== undefined ? displayLabel : name;
    const descriptionInput = description !== undefined ? description : name;
    const valueInput = value !== undefined ? value : '';

    cy.get('input[name="'+editPersesDashboardsAddVariable.inputDisplayLabel+'"]').type(displayLabelInput);
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputDescription+'"]').type(descriptionInput);
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputValue+'"]').type(valueInput);
    if (constant) {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputConstant+'"]').click();
    }

  },

  addListVariable: (
    name: string, 
    allowMultiple: boolean, 
    allowAllValue: boolean, 
    customAllValue?: string, 
    displayLabel?: string, 
    description?: string, 
    source?: persesDashboardsAddListVariableSource, 
    sort?: persesDashboardsAddListVariableSort) => {
    cy.log('persesDashboardsEditVariables.addListVariable');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains('Add Variable').should('be.visible').click();
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputName+'"]').clear().type(name);
    
    if (displayLabel !== undefined) {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputDisplayLabel+'"]').type(displayLabel);
    }
    if (description !== undefined) {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputDescription+'"]').type(description);
    }
    persesDashboardsEditVariables.clickDropdownAndSelectOption('Type', 'List');

    if (source !== undefined) {
      persesDashboardsEditVariables.clickDropdownAndSelectOption('Source', source);
    }
    if (sort !== undefined) {
      persesDashboardsEditVariables.clickDropdownAndSelectOption('Sort', sort);
    }
    if (allowMultiple) {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputAllowMultiple+'"]').click();
    }
    if (allowAllValue) {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputAllowAllValue+'"]').click();
      if (customAllValue !== undefined) {
        cy.get('input[name="'+editPersesDashboardsAddVariable.inputCustomAllValue+'"]').type(customAllValue);
      }

    }
   
  },

  clickDropdownAndSelectOption: (label: string, option: string) => {
    cy.log('persesDashboardsEditVariables.selectVariableType');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('label').contains(label).siblings('div').click();
    cy.get('li').contains(option).should('be.visible').click();

  },

  
}
