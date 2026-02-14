import { commonPages } from "./common";
import { persesAriaLabels, persesMUIDataTestIDs, IDs, editPersesDashboardsAddVariable } from "../../src/components/data-test";
import { persesDashboardsModalTitles, persesDashboardsAddListVariableSource, persesDashboardsAddListVariableSort, persesDashboardsRequiredFields } from "../fixtures/perses/constants";

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

  clickButton: (button: 'Apply' | 'Cancel' | 'Add Variable' | 'Add' | 'Run Query') => {
    cy.log('persesDashboardsEditVariables.clickButton');
    cy.wait(3000);
    if (button === 'Cancel') {
      cy.get('body').then((body) => {
        if (body.find('#'+IDs.persesDashboardDiscardChangesDialog).length > 0 && body.find('#'+IDs.persesDashboardDiscardChangesDialog).is(':visible')) {
          cy.bySemanticElement('button', 'Discard Changes').scrollIntoView().should('be.visible').click({ force: true });
        }
      });
    } else {
      cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('button').contains(button).should('be.visible').click();
    }
  },

  addTextVariable: (name: string, constant: boolean, displayLabel?: string, description?: string, value?: string) => {
    cy.log('persesDashboardsEditVariables.addTextVariable');
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputName+'"]').clear().type(name);
    
    const displayLabelInput = displayLabel !== undefined ? displayLabel : name;
    const descriptionInput = description !== undefined ? description : name;
    const valueInput = value !== undefined ? value : '';

    cy.get('input[name="'+editPersesDashboardsAddVariable.inputDisplayLabel+'"]').clear().type(displayLabelInput);
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputDescription+'"]').clear().type(descriptionInput);
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputValue+'"]').clear().type(valueInput);
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
    cy.get('input[name="'+editPersesDashboardsAddVariable.inputName+'"]').clear().type(name);
    
    if (displayLabel !== undefined && displayLabel !== '') {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputDisplayLabel+'"]').clear().type(displayLabel);
    }
    if (description !== undefined && description !== '' ) {
      cy.get('input[name="'+editPersesDashboardsAddVariable.inputDescription+'"]').clear().type(description);
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
      if (customAllValue !== undefined && customAllValue !== '') {
        cy.get('input[name="'+editPersesDashboardsAddVariable.inputCustomAllValue+'"]').clear().type(customAllValue);
      }
    }
  },

  addListVariable_staticListVariable_enterValue: (value: string) => {
    cy.log('persesDashboardsEditVariables.addListVariable_staticListVariable_enterValue');
    cy.wait(2000);
    cy.get('h6').contains('List Options').next('div').eq(0).find('input[role="combobox"]').click().type(value+'{enter}');
    cy.wait(2000);
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardAddVariableRunQueryButton).click();
    cy.wait(2000);
    cy.get('h4').contains('Preview Values').parent('div').siblings('div').contains(value).should('be.visible');
  },

  addListVariable_promLabelValuesVariable_enterLabelName: (labelName: string) => {
    cy.log('persesDashboardsEditVariables.addListVariable_promLabelValuesVariable_enterLabelName');
    cy.wait(2000);
    cy.get('label').contains('Label Name').next('div').find('input').click().type(labelName);
    cy.wait(2000);
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardAddVariableRunQueryButton).click();
    cy.wait(2000);
  },

  addListVariable_promLabelValuesVariable_addSeriesSelector: (seriesSelector: string) => {
    cy.log('persesDashboardsEditVariables.addListVariable_promLabelValuesVariable_addSeriesSelector');
    cy.wait(2000);
    cy.bySemanticElement('button', 'Add Series Selector').click();
    cy.get('label').contains('Series Selector').next('div').find('input').click().type(seriesSelector);
    cy.wait(2000);
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardAddVariableRunQueryButton).click();
    cy.wait(2000);
  },

  /**
   * 
   * @param label - label of the dropdown
   * @param option - option to select
   */
  clickDropdownAndSelectOption: (label: string, option: string) => {
    cy.log('persesDashboardsEditVariables.selectVariableType');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('label').contains(label).siblings('div').click();
    cy.get('li').contains(option).should('be.visible').click();
  },

  assertRequiredFieldValidation: (field: string) => {
    cy.log('persesDashboardsEditVariables.assertRequiredFieldValidation');

    switch (field) {
      case 'Name':
        cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('label').contains(field).siblings('p').should('have.text', persesDashboardsRequiredFields.AddVariableNameField);
        break;
    }
  },

  clickDiscardChangesButton: () => {
    cy.log('persesDashboardsEditVariables.clickDiscardChangesButton');
    cy.bySemanticElement('button', 'Discard Changes').scrollIntoView().should('be.visible').click({ force: true });
  },

  toggleVariableVisibility: (index: number, visible: boolean) => {
    cy.log('persesDashboardsEditVariables.toggleVariableVisibility');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('input[type="checkbox"]').eq(index).then((checkbox) => {
      if ((checkbox.not(':checked') && visible) || (checkbox.is(':checked') && !visible)) {
        cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('input[type="checkbox"]').eq(index).click();
      }
    });
  },

  moveVariableUp: (index: number) => {
    cy.log('persesDashboardsEditVariables.moveVariableUp');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('[data-testid="'+persesMUIDataTestIDs.editDashboardEditVariableMoveUpButton+'"]').eq(index).should('be.visible').click();
  },

  moveVariableDown: (index: number) => {
    cy.log('persesDashboardsEditVariables.moveVariableDown');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('[data-testid="'+persesMUIDataTestIDs.editDashboardEditVariableMoveDownButton+'"]').eq(index).should('be.visible').click();
  },

  clickEditVariableButton: (index: number) => {
    cy.log('persesDashboardsEditVariables.clickEditVariableButton');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('[data-testid="'+persesMUIDataTestIDs.editDashboardEditVariableDatasourceEditButton+'"]').eq(index).should('be.visible').click();
  },

  clickDeleteVariableButton: (index: number) => {
    cy.log('persesDashboardsEditVariables.clickDeleteVariableButton');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardVariablesModal).find('[data-testid="'+persesMUIDataTestIDs.editDashboardEditVariableDatasourceDeleteButton+'"]').eq(index).should('be.visible').click();
  },
}