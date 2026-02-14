import { commonPages } from "./common";
import { persesAriaLabels, persesMUIDataTestIDs, editPersesDashboardsAddDatasource, IDs } from "../../src/components/data-test";
import { persesDashboardsModalTitles, persesDashboardsRequiredFields } from "../fixtures/perses/constants";

export const persesDashboardsEditDatasources = {

  shouldBeLoaded: () => {
    cy.log('persesDashboardsEditVariables.shouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.EDIT_DASHBOARD_DATASOURCES);
    cy.byAriaLabel(persesAriaLabels.EditDashboardDatasourcesTable).should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('button').contains('Apply').should('be.visible').and('have.attr', 'disabled');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('button').contains('Cancel').should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('button').contains('Add Datasource').should('be.visible');
  },

  assertDatasource: (index: number, name: string, type: 'PrometheusDatasource' | 'TempoDatasource', description: string) => {
    cy.log('persesDashboardsEditDatasources.assertDatasource');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('tbody').find('tr').eq(index).find('th').contains(name).should('be.visible');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('tbody').find('tr').eq(index).find('td').eq(0).contains(type).should('be.visible');
    if (description !== '') {
      cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('tbody').find('tr').eq(index).find('td').eq(1).contains(description).should('be.visible');
    }
  },

  assertDatasourceNotExist: (name: string) => {
    cy.log('persesDashboardsEditDatasources.assertDatasource');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('th').contains(name).should('not.exist');
  },

  clickButton: (button: 'Apply' | 'Cancel' | 'Add Datasource' | 'Add') => {
    cy.log('persesDashboardsEditDatasources.clickButton');
    if (button === 'Cancel') {
      cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('button').contains(button).should('be.visible').click();
      cy.wait(1000);
      cy.get('body').then((body) => {
        if (body.find('#'+IDs.persesDashboardDiscardChangesDialog).length > 0 && body.find('#'+IDs.persesDashboardDiscardChangesDialog).is(':visible')) {
          cy.bySemanticElement('button', 'Discard Changes').scrollIntoView().should('be.visible').click({ force: true });
        }
      });
    } else {
      cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('button').contains(button).should('be.visible').click();
    }
  },

  addDatasource: (name: string, defaultDatasource: boolean, pluginOptions: 'Prometheus Datasource' | 'Tempo Datasource', displayLabel?: string, description?: string) => {
    cy.log('persesDashboardsEditDatasources.addDatasource');
    cy.get('input[name="'+editPersesDashboardsAddDatasource.inputName+'"]').clear().type(name);
    if (displayLabel !== undefined) {
      cy.get('input[name="'+editPersesDashboardsAddDatasource.inputDisplayLabel+'"]').clear().type(displayLabel);
    }
    if (description !== undefined) {
      cy.get('input[name="'+editPersesDashboardsAddDatasource.inputDescription+'"]').clear().type(description);
    }

    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('input[name="'+editPersesDashboardsAddDatasource.inputDefaultDatasource+'"]').then((checkbox) => {
      if ((checkbox.not(':checked') && defaultDatasource) || (checkbox.is(':checked') && !defaultDatasource)) {
        cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('input[name="'+editPersesDashboardsAddDatasource.inputDefaultDatasource+'"]').click();
      }
    });

    persesDashboardsEditDatasources.clickDropdownAndSelectOption('Source', pluginOptions);
    
  },

  clickDropdownAndSelectOption: (label: string, option: string) => {
    cy.log('persesDashboardsEditVariables.selectVariableType');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('label').contains(label).siblings('div').click();
    cy.get('li').contains(option).should('be.visible').click();
  },

  assertRequiredFieldValidation: (field: string) => {
    cy.log('persesDashboardsEditVariables.assertRequiredFieldValidation');

    switch (field) {
      case 'Name':
        cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('label').contains(field).siblings('p').should('have.text', persesDashboardsRequiredFields.AddVariableNameField);
        break;
    }
  },

  clickDiscardChangesButton: () => {
    cy.log('persesDashboardsEditVariables.clickDiscardChangesButton');
    cy.bySemanticElement('button', 'Discard Changes').scrollIntoView().should('be.visible').click({ force: true });
  },

  clickEditDatasourceButton: (index: number) => {
    cy.log('persesDashboardsEditDatasources.clickEditDatasourceButton');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('[data-testid="'+persesMUIDataTestIDs.editDashboardEditVariableDatasourceEditButton+'"]').eq(index).should('be.visible').click();
  },

  clickDeleteDatasourceButton: (index: number) => {
    cy.log('persesDashboardsEditDatasources.clickDeleteDatasourceButton');
    cy.byDataTestID(persesMUIDataTestIDs.editDashboardDatasourcesModal).find('[data-testid="'+persesMUIDataTestIDs.editDashboardEditVariableDatasourceDeleteButton+'"]').eq(index).should('be.visible').click();
  },
}