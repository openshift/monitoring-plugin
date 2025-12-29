import { commonPages } from "./common";
import { DataTestIDs, Classes, listPersesDashboardsOUIAIDs, listPersesDashboardsDataTestIDs, IDs } from "../../src/components/data-test";
import { listPersesDashboardsEmptyState, listPersesDashboardsPageSubtitle } from "../fixtures/perses/constants";
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
    cy.byTestID(DataTestIDs.FavoriteStarButton).should('be.visible');
    cy.byOUIAID(listPersesDashboardsOUIAIDs.PersesDashListDataViewTable).should('be.visible');

  },

  filter: {
    byName: (name: string) => {
      cy.log('listPersesDashboardsPage.filter.byName');
      cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewFilters).contains('button',/Name|Project/).scrollIntoView().click();
      cy.get(Classes.FilterDropdownOption).should('be.visible').contains('Name').click();      
      cy.byTestID(listPersesDashboardsDataTestIDs.NameFilter).should('be.visible').type(name);
      cy.byTestID(listPersesDashboardsDataTestIDs.NameFilter).find('input').should('have.attr', 'value', name);
    },
    byProject: (project: string) => {
      cy.log('listPersesDashboardsPage.filter.byProject');
      cy.byOUIAID(listPersesDashboardsOUIAIDs.persesListDataViewFilters).contains('button',/Name|Project/).scrollIntoView().click();
      cy.get(Classes.FilterDropdownOption).should('be.visible').contains('Project').click();
      cy.byTestID(listPersesDashboardsDataTestIDs.ProjectFilter).should('be.visible').type(project);
      cy.byTestID(listPersesDashboardsDataTestIDs.ProjectFilter).find('input').should('have.attr', 'value', project);
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
    cy.byTestID(listPersesDashboardsDataTestIDs.DashboardLinkPrefix+name).eq(idx).should('be.visible').click();
    cy.wait(15000);
  },

  removeTag: (value: string) => {
    cy.log('listPersesDashboardsPage.removeTag');
    cy.byAriaLabel('Close '+ value).click();
  },
} 
