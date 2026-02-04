import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';
import { commonPages } from '../../views/common';
import { listPersesDashboardsPage } from "../../views/perses-dashboards-list-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOListPersesTests(perspective: PerspectiveConfig) {
  testCOOListPerses(perspective);
}

export function runCOOListPersesDuplicateDashboardTests(perspective: PerspectiveConfig) {
  testCOOListPersesDuplicateDashboard(perspective);
}

export function testCOOListPerses(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards (Perses) page`, () => {
    cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`1.2. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`1.3. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`1.4. Filter by Project and Name`);
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.countDashboards('3');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`1.5. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`1.6. Filter by Project`);
    listPersesDashboardsPage.filter.byProject('perses-dev');

    cy.log(`1.7. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();
    
    cy.log(`1.8. Sort by Dashboard - Ascending`);
    listPersesDashboardsPage.sortBy('Dashboard');
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0], 0);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.APM_DASHBOARD[0], 1);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0], 2);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0], 3);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0], 4);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0], 5);

    cy.log(`1.9. Sort by Dashboard - Descending`);
    listPersesDashboardsPage.sortBy('Dashboard');
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0], 0);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0], 1);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0], 2);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0], 3);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.APM_DASHBOARD[0], 4);
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0], 5);

    cy.log(`1.10. Filter by Name - Empty state`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]);
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`1.11. Clear all filters`);
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`1.12. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    //TODO: change back to shouldBeLoaded when customizable-dashboards gets merged
    // persesDashboardsPage.shouldBeLoaded1();
  });

  
  it(`2.${perspective.name} perspective - Kebab icon - Options available - Rename dashboard - Max length validation`, () => {
    cy.log(`2.1. Filter by Name and click on the Kebab icon`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);

    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.assertKebabIconOptions();
    listPersesDashboardsPage.clickKebabIcon();

    cy.log(`2.2. Click on the Kebab icon - Rename dashboard`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName('1234567890123456789012345678901234567890123456789012345678901234567890123456');
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.assertRenameDashboardMaxLength(); 
    listPersesDashboardsPage.renameDashboardCancelButton();

    cy.log(`2.3. Clear all filters and filter by Name`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clearAllFilters();

  });

  it(`3.${perspective.name} perspective - Kebab icon - Options available - Rename dashboard`, () => {
    let dashboardName = 'Dashboard to test rename';
    let randomSuffix = Math.random().toString(5);
    dashboardName += randomSuffix;

    cy.log(`3.1. Filter by Name and click on the Kebab icon`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);

    cy.log(`3.2. Click on the Kebab icon - Rename dashboard - Cancel`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(dashboardName);
    listPersesDashboardsPage.renameDashboardCancelButton();
    listPersesDashboardsPage.assertDashboardName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0], 0);

    cy.log(`3.3. Click on the Kebab icon - Rename dashboard - Rename`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(dashboardName);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`3.4. Clear all filters and filter by Name`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`3.5. Click on dashboard and verify the name`);
    listPersesDashboardsPage.clickDashboard(dashboardName);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.shouldBeLoadedAfterRename(dashboardName);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`3.6. Rename back to the original name`);
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(dashboardName);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`3.7. Click on the Kebab icon - Rename dashboard - Rename`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`3.8. Clear all filters and filter by Name`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`3.9. Click on dashboard and verify the name`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.shouldBeLoadedAfterRename(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    persesDashboardsPage.backToListPersesDashboardsPage();

  });

  //TODO: Add test for Rename to an existing dashboard name to be addressed by https://issues.redhat.com/browse/OU-1220
  it(`4.${perspective.name} perspective - Kebab icon - Options available - Rename dashboard to an existing dashboard name`, () => {
    cy.log(`4.1. Filter by Name and click on the Kebab icon`);
    commonPages.titleShouldHaveText('Dashboards');
    listPersesDashboardsPage.shouldBeLoaded();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    

    cy.log(`4.2. Click on the Kebab icon - Rename dashboard - Rename`);
    listPersesDashboardsPage.clickKebabIcon();
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0]);
    listPersesDashboardsPage.renameDashboardRenameButton();
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.countDashboards('0');

    cy.log(`4.3. Clear all filters and filter by Name`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PROMETHEUS_OVERVIEW[0]);
    listPersesDashboardsPage.countDashboards('2');

    cy.log(`4.4. Sort by Last Modified - Descending`);
    listPersesDashboardsPage.sortBy('Last Modified');
    listPersesDashboardsPage.sortBy('Last Modified');
    listPersesDashboardsPage.clickKebabIcon(0);
    listPersesDashboardsPage.clickRenameDashboardOption();
    listPersesDashboardsPage.renameDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    listPersesDashboardsPage.renameDashboardRenameButton();
    cy.wait(2000);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`4.5. Clear all filters and filter by Name`);
    listPersesDashboardsPage.clearAllFilters();
    listPersesDashboardsPage.filter.byProject('perses-dev');
    cy.wait(2000);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.THANOS_COMPACT_OVERVIEW[0]);
    cy.wait(2000);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clearAllFilters();
  });
}

  export function testCOOListPersesDuplicateDashboard(perspective: PerspectiveConfig) {

    it(`5.${perspective.name} perspective - Duplicate - existing dashboard ID in the same project`, () => {
      cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`5.2. Filter by Name and click on the Kebab icon`);
      listPersesDashboardsPage.filter.byProject('perses-dev');
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`5.3. Click on the Kebab icon - Duplicate`);
      listPersesDashboardsPage.clickKebabIcon();
      listPersesDashboardsPage.clickDuplicateOption();
      listPersesDashboardsPage.assertDuplicateProjectDropdown('openshift-cluster-observability-operator');
      listPersesDashboardsPage.assertDuplicateProjectDropdown('perses-dev');
      listPersesDashboardsPage.duplicateDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.duplicateDashboardDuplicateButton();
      listPersesDashboardsPage.assertDuplicateDashboardAlreadyExists();
      listPersesDashboardsPage.duplicateDashboardCancelButton();
      listPersesDashboardsPage.clearAllFilters();
  
    });
  
    it(`6.${perspective.name} perspective - Duplicate - existing dashboard name in the same project`, () => {
      cy.log(`6.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`6.2. Filter by Name and click on the Kebab icon`);
      listPersesDashboardsPage.filter.byProject('perses-dev');
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`6.3. Click on the Kebab icon - Duplicate`);
      listPersesDashboardsPage.clickKebabIcon();
      listPersesDashboardsPage.clickDuplicateOption();
      listPersesDashboardsPage.duplicateDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.duplicateDashboardDuplicateButton();
      persesDashboardsPage.shouldBeLoadedEditionMode(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      persesDashboardsPage.shouldBeLoadedAfterDuplicate(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
  
      cy.log(`6.4. Back to the list and duplicate to another project`);
      persesDashboardsPage.backToListPersesDashboardsPage();
  
      listPersesDashboardsPage.filter.byProject('perses-dev');
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('2');
      
      cy.log(`6.5. Sort by Last Modified - Descending`);
      listPersesDashboardsPage.sortBy('Last Modified');
  
      cy.log(`6.6. Click on the Kebab icon - Duplicate with the same Dashboard name`);
      listPersesDashboardsPage.clickKebabIcon(0);
      listPersesDashboardsPage.clickDuplicateOption();
      listPersesDashboardsPage.duplicateDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.duplicateDashboardDuplicateButton();
      listPersesDashboardsPage.assertDuplicateDashboardAlreadyExists();    
      listPersesDashboardsPage.duplicateDashboardCancelButton();
      listPersesDashboardsPage.clearAllFilters();
  
    });
  
    it(`7.${perspective.name} perspective - Duplicate - existing dashboard ID in another project`, () => {
      cy.log(`7.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`7.2. Filter by Name and click on the Kebab icon`);
      listPersesDashboardsPage.filter.byProject('perses-dev');
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('2');
  
      cy.log(`7.3. Click on the Kebab icon - Duplicate`);
      listPersesDashboardsPage.clickKebabIcon(0);
      listPersesDashboardsPage.clickDuplicateOption();
      listPersesDashboardsPage.duplicateDashboardEnterName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.duplicateDashboardSelectProjectDropdown('openshift-cluster-observability-operator');
      listPersesDashboardsPage.duplicateDashboardDuplicateButton();
      persesDashboardsPage.shouldBeLoadedEditionMode(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      persesDashboardsPage.shouldBeLoadedAfterDuplicate(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      persesDashboardsPage.backToListPersesDashboardsPage();
  
    });
  
    it(`8.${perspective.name} perspective - Delete and Cancel and then Delete`, () => {
      cy.log(`8.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      commonPages.titleShouldHaveText('Dashboards');
      listPersesDashboardsPage.shouldBeLoaded();
  
      cy.log(`8.2. Filter by Name and click on the Kebab icon`);
      listPersesDashboardsPage.filter.byProject('perses-dev');
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
      listPersesDashboardsPage.countDashboards('2');
      listPersesDashboardsPage.sortBy('Last Modified');
      listPersesDashboardsPage.sortBy('Last Modified');
  
      cy.log(`8.4. Click on the Kebab icon - Delete`);
      listPersesDashboardsPage.clickKebabIcon(0);
      listPersesDashboardsPage.clickDeleteOption();
      listPersesDashboardsPage.deleteDashboardCancelButton();
      listPersesDashboardsPage.countDashboards('2');
  
      cy.log(`8.5. Click on the Kebab icon - Delete`);
      listPersesDashboardsPage.clickKebabIcon(0);
      listPersesDashboardsPage.clickDeleteOption();
      listPersesDashboardsPage.deleteDashboardDeleteButton();
      listPersesDashboardsPage.countDashboards('1');
      listPersesDashboardsPage.clearAllFilters();
  
      cy.log(`8.6. Filter by Name and click on the Kebab icon`);
      listPersesDashboardsPage.filter.byProject('openshift-cluster-observability-operator');
      listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]);
      listPersesDashboardsPage.countDashboards('1');
  
      cy.log(`8.7. Click on the Kebab icon - Delete`);
      listPersesDashboardsPage.clickKebabIcon();
      listPersesDashboardsPage.clickDeleteOption();
      listPersesDashboardsPage.deleteDashboardDeleteButton();
      listPersesDashboardsPage.emptyState();
      listPersesDashboardsPage.countDashboards('0');
      listPersesDashboardsPage.clearAllFilters();
     
    });
  }

  //TODO: Verify Duplicate Dashboard - Select project dropdown not only showing perses projects, but all namespaces you have access to, independently of having perses object (that creates a perses project)
  // it(`9.${perspective.name} perspective - Verify Duplicate Dashboard - Select project dropdown not only showing perses projects, but all namespaces you have access to, independently of having perses object (that creates a perses project)`, () => {
    // cy.log(`9.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    // commonPages.titleShouldHaveText('Dashboards');
    // listPersesDashboardsPage.shouldBeLoaded();

    // cy.log(`9.2. Click on the Kebab icon - Duplicate`);
    // listPersesDashboardsPage.clickKebabIcon();
    // listPersesDashboardsPage.clickDuplicateDashboardOption();
    // listPersesDashboardsPage.assertProjectDropdown('openshift-cluster-observability-operator');
    // openshift-monitoringas an example of a namespace that you have access to and does not have any perses object created yet, but you are able to create a dashboard
    // listPersesDashboardsPage.assertProjectDropdown('openshift-monitoring');
  // });

  //TODO: Delete namespace and check project dropdown does not load this namespace
  // it(`10.${perspective.name} perspective - Delete namespace and check project dropdown does not load this namespace`, () => {
  // OU-1192 - [Perses operator] - Delete namespace is not deleting perses project
  //  
  // });