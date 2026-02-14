import { commonPages } from "./common";
import { DataTestIDs, Classes, listPersesDashboardsOUIAIDs, listPersesDashboardsDataTestIDs, IDs, persesAriaLabels } from "../../src/components/data-test";
import { listPersesDashboardsEmptyState, listPersesDashboardsPageSubtitle, persesDashboardsDuplicateDashboard, persesDashboardsRenameDashboard } from "../fixtures/perses/constants";
import { MonitoringPageTitles } from "../fixtures/monitoring/constants";

export const listPersesDashboardsPage = {

  emptyState: () => {
    cy.log('listPersesDashboardsPage.emptyState');
    cy.byTestID(listPersesDashboardsDataTestIDs.EmptyStateTitle).should('be.visible').contains(listPersesDashboardsEmptyState.TITLE);
    cy.byTestID(listPersesDashboardsDataTestIDs.EmptyStateBody).should('be.visible').contains(listPersesDashboardsEmptyState.BODY);
    cy.byTestID(listPersesDashboardsDataTestIDs.ClearAllFiltersButton).should('be.visible');
  },

  shouldBeLoaded: () => {
    cy.log('listPersesDashboardsPage.shouldBeLoaded');
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PersesBreadcrumb).should('not.exist');
    commonPages.titleShouldHaveText(MonitoringPageTitles.DASHBOARDS);
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PageHeaderSubtitle).should('contain', listPersesDashboardsPageSubtitle).should('be.visible');
    cy.byTestID(DataTestIDs.PersesCreateDashboardButton).scrollIntoView().should('be.visible');
    cy.byTestID(DataTestIDs.FavoriteStarButton).should('be.visible');
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PersesDashListDataViewTable).should('be.visible');

  },

  filter: {
    byName: (name: string) => {
      cy.log('listPersesDashboardsPage.filter.byName');
      cy.wait(1000);
      cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewFilters).contains('button',/Name|Project/).click( { force: true });
      cy.wait(1000);
      cy.get(Classes.FilterDropdownOption).should('be.visible').contains('Name').click( { force: true });      
      cy.wait(1000);
      cy.byTestID(listPersesDashboardsDataTestIDs.NameFilter).should('be.visible').type(name);
      cy.wait(1000);
      cy.byTestID(listPersesDashboardsDataTestIDs.NameFilter).find('input').should('have.attr', 'value', name);
      cy.wait(2000);
    },
    byProject: (project: string) => {
      cy.log('listPersesDashboardsPage.filter.byProject');
      cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewFilters).contains('button',/Name|Project/).click( { force: true });
      cy.wait(1000);
      cy.get(Classes.FilterDropdownOption).should('be.visible').contains('Project').click( { force: true });
      cy.wait(1000);
      cy.byTestID(listPersesDashboardsDataTestIDs.ProjectFilter).should('be.visible').type(project);
      cy.wait(1000);
      cy.byTestID(listPersesDashboardsDataTestIDs.ProjectFilter).find('input').should('have.attr', 'value', project);
      cy.wait(2000);
    },
  },

  countDashboards: (count: string) => {
    cy.log('listPersesDashboardsPage.countDashboards');
    cy.wait(2000);
    cy.get('#'+ IDs.persesDashboardCount,).find(Classes.PersesListDashboardCount).invoke('text').should((text) => {
      const total = text.split('of')[1].trim();
      expect(total).to.equal(count);
    });
  },

  clearAllFilters: () => {
    cy.log('listPersesDashboardsPage.clearAllFilters');
    cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewHeaderClearAllFiltersButton).click();
    cy.wait(5000);
  },

  sortBy: (column: string) => {
    cy.log('listPersesDashboardsPage.sortBy');
    cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewHeaderSortButton).contains(column).scrollIntoView().click();
  },

  /**
   * If index is not provided, it asserts the existence of the dashboard by appending the name to the prefix to build data-test id, expecting to be unique
   * If index is provided, it asserts the existence of the dashboard by the index.
   * @param name - The name of the dashboard to assert
   * @param index - The index of the dashboard to assert (optional)
   */
  assertDashboardName: (name: string, index?: number) => {
    cy.log('listPersesDashboardsPage.assertDashboardName');
    const idx = index !== undefined ? index : 0;
    if (index === undefined) {
      cy.byTestID(listPersesDashboardsDataTestIDs.DashboardLinkPrefix+name).should('be.visible').contains(name);
    } else {
      cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewTableDashboardNameTD+idx.toString()).should('be.visible').contains(name);
    }
  },

  clickDashboard: (name: string, index?: number) => {
    const idx = index !== undefined ? index : 0;
    cy.log('listPersesDashboardsPage.clickDashboard');
    // cy.byTestID(listPersesDashboardsDataTestIDs.DashboardLinkPrefix+name).eq(idx).should('be.visible').click();
    cy.get('a').contains(name).eq(idx).should('be.visible').click();
    cy.wait(15000);
  },

  removeTag: (value: string) => {
    cy.log('listPersesDashboardsPage.removeTag');
    cy.byAriaLabel('Close '+ value).click();
  },

  clickCreateButton: () => {
    cy.log('persesDashboardsPage.clickCreateButton');
    cy.byTestID(DataTestIDs.PersesCreateDashboardButton).scrollIntoView().should('be.visible').and('not.have.attr', 'disabled');
    cy.byTestID(DataTestIDs.PersesCreateDashboardButton).click({ force: true });
    cy.wait(2000);
  },

  assertCreateButtonIsEnabled: () => {
    cy.log('persesDashboardsPage.assertCreateButtonIsEnabled');
    cy.byTestID(DataTestIDs.PersesCreateDashboardButton).scrollIntoView().should('be.visible').should('not.have.attr', 'disabled');
  },

  assertCreateButtonIsDisabled: () => {
    cy.log('persesDashboardsPage.assertCreateButtonIsDisabled');
    cy.byTestID(DataTestIDs.PersesCreateDashboardButton).scrollIntoView().should('be.visible').should('have.attr', 'disabled');
  },

  clickKebabIcon: (index?: number) => {
    const idx = index !== undefined ? index : 0;
    cy.log('persesDashboardsPage.clickKebabIcon');
    cy.byAriaLabel(persesAriaLabels.persesDashboardKebabIcon).eq(idx).scrollIntoView().should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertKebabIconOptions: () => {
    cy.log('persesDashboardsPage.assertKebabIconOptions');
    cy.byPFRole('menuitem').contains('Rename dashboard').should('be.visible');
    cy.byPFRole('menuitem').contains('Duplicate dashboard').should('be.visible');
    cy.byPFRole('menuitem').contains('Delete dashboard').should('be.visible');
  },

  assertKebabIconDisabled: () => {
    cy.log('persesDashboardsPage.assertKebabIconDisabled');
    cy.byAriaLabel(persesAriaLabels.persesDashboardKebabIcon).scrollIntoView().should('be.visible').should('have.attr', 'disabled');
  },

  clickRenameDashboardOption: () => {
    cy.log('listPersesDashboardsPage.clickRenameDashboardOption');
    cy.wait(1000);
    cy.byPFRole('menuitem').contains('Rename dashboard').should('be.visible').click({ force: true });
    cy.wait(1000);
  },

  renameDashboardEnterName: (name: string) => {
    cy.log('listPersesDashboardsPage.renameDashboardEnterName');
    cy.get('#'+IDs.persesDashboardRenameDashboardName).should('be.visible').clear().type(name);
    cy.wait(1000);
  },

  renameDashboardCancelButton: () => {
    cy.log('listPersesDashboardsPage.renameDashboardCancel');
    cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  renameDashboardRenameButton: () => {
    cy.log('listPersesDashboardsPage.renameDashboardRename');
    cy.byPFRole('dialog').find('button').contains('Rename').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertRenameDashboardMaxLength: () => {
    cy.log('listPersesDashboardsPage.assertRenameDashboardMaxLength');
    cy.byPFRole('dialog').find(Classes.PersesCreateDashboardDashboardNameError).should('have.text', persesDashboardsRenameDashboard.DIALOG_MAX_LENGTH_VALIDATION).should('be.visible');
  },

  clickDuplicateOption: () => {
    cy.log('listPersesDashboardsPage.clickDuplicateOption');
    cy.byPFRole('menuitem').contains('Duplicate dashboard').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertDuplicateProjectDropdown: (project: string) => {
    cy.log('listPersesDashboardsPage.assertDuplicateProjectDropdown');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(project).should('be.visible');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
  },

  duplicateDashboardEnterName: (name: string) => {
    cy.log('listPersesDashboardsPage.duplicateDashboardEnterName');
    cy.get('#' + IDs.persesDashboardDuplicateDashboardName).should('be.visible').clear().type(name);
    cy.wait(1000);
  },

  duplicateDashboardCancelButton: () => {
    cy.log('listPersesDashboardsPage.duplicateDashboardCancel');
    cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  duplicateDashboardDuplicateButton: () => {
    cy.log('listPersesDashboardsPage.duplicateDashboardDuplicate');
    cy.byPFRole('dialog').find('button').contains('Duplicate').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertDuplicateDashboardAlreadyExists: () => {
    cy.log('listPersesDashboardsPage.assertDuplicateDashboardAlreadyExists');
    cy.byPFRole('dialog').find(Classes.PersesCreateDashboardDashboardNameError)
      .contains(persesDashboardsDuplicateDashboard.DIALOG_DUPLICATED_NAME_VALIDATION)
      .should('be.visible');
  },

  duplicateDashboardSelectProjectDropdown: (project: string) => {
    cy.log('listPersesDashboardsPage.duplicateDashboardSelectProjectDropdown');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
    cy.byPFRole('option').contains(project).should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertDuplicateProjectDropdownOptions: (project: string, contains: boolean) => {
    cy.log('listPersesDashboardsPage.assertDuplicateProjectDropdownOptions');
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
    if (contains) {
      cy.byPFRole('option').contains(project).should('be.visible');
      cy.log('Project: ' + project + ' is available in the dropdown');
    } else {
      cy.byPFRole('option').should('not.contain', project);
      cy.log('Project: ' + project + ' is not available in the dropdown');
    }
    cy.get(Classes.PersesCreateDashboardProjectDropdown).should('be.visible').click({ force: true });
  },

  clickDeleteOption: () => {
    cy.log('listPersesDashboardsPage.clickDeleteOption');
    cy.byPFRole('menuitem').contains('Delete dashboard').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  deleteDashboardCancelButton: () => {
    cy.log('listPersesDashboardsPage.deleteDashboardCancel');
    cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  deleteDashboardDeleteButton: () => {
    cy.log('listPersesDashboardsPage.deleteDashboardDelete');
    cy.byPFRole('dialog').find('button').contains('Delete').should('be.visible').click({ force: true });
    cy.wait(2000);
  },
} 