import { commonPages } from "./common";
import { persesAriaLabels, IDs, editPersesDashboardsAddPanel, Classes } from "../../src/components/data-test";
import { persesDashboardsModalTitles, persesDashboardsAddPanelAddQueryType, persesDashboardsAddListPanelType } from "../fixtures/perses/constants";

export const persesDashboardsPanel = {

  addPanelShouldBeLoaded: () => {
    cy.log('persesDashboardsPanel.addPanelShouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.ADD_PANEL);
    cy.get('input[name="' + editPersesDashboardsAddPanel.inputName + '"]').should('be.visible');
    cy.get('#' + IDs.persesDashboardAddPanelForm).find('label').contains('Group').should('be.visible');
    cy.get('input[name="' + editPersesDashboardsAddPanel.inputDescription + '"]').should('be.visible');
    cy.get('#' + IDs.persesDashboardAddPanelForm).find('label').contains('Type').should('be.visible');
    cy.get('#' + IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Add').should('be.visible').and('have.attr', 'disabled');
    cy.get('#' + IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Cancel').should('be.visible');
  },

  clickButton: (button: 'Add' | 'Cancel') => {
    cy.log('persesDashboardsPanel.clickButton');
    if (button === 'Cancel') {
      cy.get('#' + IDs.persesDashboardAddPanelForm).siblings('div').find('button').contains(button).should('be.visible').click();
      cy.wait(1000);
      cy.get('body').then((body) => {
        if (body.find('#' + IDs.persesDashboardDiscardChangesDialog).length > 0 && body.find('#' + IDs.persesDashboardDiscardChangesDialog).is(':visible')) {
          cy.bySemanticElement('button', 'Discard Changes').scrollIntoView().should('be.visible').click({ force: true });
        }
      });
    } else {
      cy.get('#' + IDs.persesDashboardAddPanelForm).siblings('div').find('button').contains(button).should('be.visible').click();
    }
  },

  clickDropdownAndSelectOption: (label: string, option: string) => {
    cy.log('persesDashboardsPanel.clickDropdownAndSelectOption');
    cy.get('#' + IDs.persesDashboardAddPanelForm).find('label').contains(label).siblings('div').click();
    cy.wait(1000);
    cy.get('li').contains(new RegExp(`^${option}$`)).should('be.visible').click();
  },

  assertRequiredFieldValidation: (field: string) => {
    cy.log('persesDashboardsPanel.assertRequiredFieldValidation');

    switch (field) {
      case 'Name':
        cy.get('#' + IDs.persesDashboardAddPanelForm).find('label').contains(field).siblings('p').should('have.text', 'Required');
        break;
    }
  },

  addPanel: (name: string, group: string, type: string, description?: string, query?: string | 'up' | 'haproxy_up', legend?: string) => {
    cy.log('persesDashboardsPanel.addPanel');
    cy.wait(2000);
    cy.get('input[name="' + editPersesDashboardsAddPanel.inputName + '"]').clear().type(name);
    if (description !== undefined && description !== '') {
      cy.get('input[name="' + editPersesDashboardsAddPanel.inputDescription + '"]').clear().type(description);
    }
    persesDashboardsPanel.clickDropdownAndSelectOption('Group', group);
    
    cy.wait(1000);
    persesDashboardsPanel.clickDropdownAndSelectOption('Type', type);

    switch (type) {
      //BAR_GAUGE_HEAT_HISTOGRAM_PIE_STAT_STATUS_TABLE_TIMESERIES
      case persesDashboardsAddListPanelType.BAR_CHART:
      // case persesDashboardsAddListPanelType.HEATMAP_CHART:
      // case persesDashboardsAddListPanelType.HISTOGRAM_CHART:
      // case persesDashboardsAddListPanelType.PIE_CHART:
      // case persesDashboardsAddListPanelType.STAT_CHART:
      case persesDashboardsAddListPanelType.STATUS_HISTORY_CHART:
      case persesDashboardsAddListPanelType.TABLE:
      case persesDashboardsAddListPanelType.TIME_SERIES_CHART:
      case persesDashboardsAddListPanelType.TIME_SERIES_TABLE:
        
        cy.wait(2000);
        persesDashboardsPanel.clickDropdownAndSelectOption('Query Type', persesDashboardsAddPanelAddQueryType.BAR_GAUGE_HEAT_HISTOGRAM_PIE_STAT_STATUS_TABLE_TIMESERIES.PROMETHEUS_TIME_SERIES_QUERY);
        cy.wait(2000);
        if (query !== undefined && query !== '') {
          persesDashboardsPanel.enterPromQLQuery(query);
        }
        else {
          persesDashboardsPanel.enterPromQLQuery('up');
        }
        if (legend !== undefined && legend !== '') {
          cy.get('label').contains('Legend').next('div').find('input').click().type(legend);
        }
        break;
    }
    cy.get('#'+IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Add').should('be.visible').click();
  },

  enterPromQLQuery: (query: string | 'up' | 'haproxy_up') => {
    cy.log('persesDashboardsPanel.enterPromQLQuery');
    cy.get('[data-testid="promql_expression_editor"] .cm-line')
      .then(($el) => {
        $el[0].textContent = `${query}`;
        $el[0].dispatchEvent(new Event('input', { bubbles: true }));
        $el[0].dispatchEvent(new Event('blur', { bubbles: true }));
      });
    cy.wait(3000);
    cy.get('body').then(($body) => {
      const $el = $body.find('[data-testid="promql_expression_editor"] .cm-tooltip-autocomplete.cm-tooltip.cm-tooltip-below li[aria-selected="true"]');
      if ($el.length > 0) {
        // Use native DOM events since $el[0] is a raw DOM element
        $el[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        $el[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });

    cy.wait(3000);
    cy.get('[data-testid="promql_expression_editor"] .cm-line').click();
    cy.wait(3000);
    cy.bySemanticElement('button', 'Run Query').scrollIntoView().should('be.visible').click({ force: true });
    cy.wait(3000);
  },

  editPanelShouldBeLoaded: () => {
    cy.log('persesDashboardsPanel.editPanelShouldBeLoaded');
    commonPages.titleModalShouldHaveText(persesDashboardsModalTitles.ADD_PANEL);
    cy.get('input[name="' + editPersesDashboardsAddPanel.inputName + '"]').should('be.visible');
    cy.get('#' + IDs.persesDashboardAddPanelForm).find('label').contains('Group').should('be.visible');
    cy.get('input[name="' + editPersesDashboardsAddPanel.inputDescription + '"]').should('be.visible');
    cy.get('#' + IDs.persesDashboardAddPanelForm).find('label').contains('Type').should('be.visible');
    cy.get('#' + IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Apply').should('be.visible').and('have.attr', 'disabled');
    cy.get('#' + IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Cancel').should('be.visible');
  },

  editPanel: (name: string, group: string, type: string, description?: string) => {
    cy.log('persesDashboardsPanel.editPanel');
    cy.get('input[name="' + editPersesDashboardsAddPanel.inputName + '"]').clear().type(name);
    if (description !== undefined && description !== '') {
      cy.get('input[name="' + editPersesDashboardsAddPanel.inputDescription + '"]').clear().type(description);
    }
    persesDashboardsPanel.clickDropdownAndSelectOption('Group', group);
    persesDashboardsPanel.clickDropdownAndSelectOption('Type', type);
    cy.get('#' + IDs.persesDashboardAddPanelForm).parent('div').find('h2').siblings('div').find('button').contains('Apply').should('be.visible').click();
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

  deletePanel: (panel: string) => {
    cy.log('persesDashboardsPage.deletePanel');
    cy.byAriaLabel(persesAriaLabels.EditPanelDeleteButtonPrefix + panel).scrollIntoView().should('be.visible').click({ force: true });
  },

  clickDeletePanelButton: () => {
    cy.log('persesDashboardsPage.clickDeletePanelButton');
    cy.bySemanticElement('button', 'Delete').scrollIntoView().should('be.visible').click({ force: true });
  },
}