import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/perses-dashboards-list-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOListPersesTestsNamespace(perspective: PerspectiveConfig) {
  testCOOListPersesNamespace(perspective);
}

export function testCOOListPersesNamespace(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards (Perses) page`, () => {
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`1.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.countDashboards('3');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`1.3. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`1.4. Sort by Dashboard - Ascending`);
    listPersesDashboardsPage.sortBy('Dashboard');
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0], 0);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0], 1);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0], 2);

    cy.log(`1.5. Sort by Dashboard - Descending`);
    listPersesDashboardsPage.sortBy('Dashboard');
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0], 0);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0], 1);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0], 2);
    

    cy.log(`1.6. Change namespace to openshift-cluster-observability-operator`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.countDashboards('3');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`1.7. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();

    
    cy.log(`1.8. Sort by Dashboard - Ascending`);
    listPersesDashboardsPage.sortBy('Dashboard');
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0], 0);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.APM_DASHBOARD[0], 1);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0], 2);

    cy.log(`1.9. Sort by Dashboard - Descending`);
    listPersesDashboardsPage.sortBy('Dashboard');
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0], 0);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.APM_DASHBOARD[0], 1);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0], 2);

    cy.log(`1.10. Filter by Name - Empty state`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0]);
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`1.11. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`1.12. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownCOO.APM_DASHBOARD[0]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    persesDashboardsPage.shouldBeLoaded1();
  });

  it(`2.${perspective.name} perspective - Duplicate from a project to another, Rename and Delete`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.countDashboards('3');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`2.3. Click on the Kebab icon - Duplicate to another project`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDuplicateOption();
    listPersesDashboardsPage.duplicateDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.duplicateDashboardSelectProjectDropdown('openshift-cluster-observability-operator');
    listPersesDashboardsPage.duplicateDashboardDuplicateButton();
    persesDashboardsPage.shouldBeLoadedEditionMode(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    persesDashboardsPage.shouldBeLoadedAfterDuplicate(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`2.4. Click on the Kebab icon - Rename`);
    cy.changeNamespace('openshift-cluster-observability-operator');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] + ' - Renamed');
    listPersesDashboardsPage.renameDashboardRenameButton();

    cy.log(`2.5. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] + ' - Renamed');
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`2.6. Click on the Kebab icon - Delete`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickDeleteOption();
    listPersesDashboardsPage.deleteDashboardDeleteButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`2.7. Search for the renamed dashboard`);
    listPersesDashboardsPage.clearAllFilters();
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0] + ' - Renamed');
    listPersesDashboardsPage.countDashboards('0');
    listPersesDashboardsPage.clearAllFilters();
    
  });
 

}