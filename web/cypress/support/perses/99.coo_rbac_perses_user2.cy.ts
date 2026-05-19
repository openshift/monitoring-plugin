import { persesDashboardsPage } from '../../views/perses-dashboards';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesDashboardsDashboardDropdownCOO, persesDashboardsDashboardDropdownPersesDev } from '../../fixtures/perses/constants';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOORBACPersesTestsDevUser2(perspective: PerspectiveConfig) {
  testCOORBACPersesTestsDevUser2(perspective);
}

/**
 * User2 has access to:
 * - perses-dev namespace as persesdashboard-viewer-role and persesdatasource-viewer-role
 * - no access to openshift-cluster-observability-operator and observ-test namespaces
 * - openshift-monitoring as view role
 */
export function testCOORBACPersesTestsDevUser2(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards - Namespace validation and Dashboard search`, () => {
    cy.log(`1.1. Namespace validation`);
    listPersesDashboardsPage.shouldBeLoaded();
    cy.assertNamespace('All Projects', true);
    cy.assertNamespace('openshift-cluster-observability-operator', false);
    cy.assertNamespace('observ-test', false);
    cy.assertNamespace('empty-namespace3', false);
    cy.assertNamespace('empty-namespace4', false);
    cy.assertNamespace('openshift-monitoring', true);
    cy.assertNamespace('perses-dev', true);

    cy.log(`1.2. All Projects validation - Dashboard search - ${persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]} dashboard`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.removeTag('perses-dev');

    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);

    cy.log(`1.3. All Projects validation - Dashboard search - ${persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]} dashboard`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0]);

    cy.log(`1.4. All Projects validation - Dashboard search - ${persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]} dashboard`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0]);
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.removeTag(persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0]);

    cy.log(`1.5. All Projects validation - Dashboard search - empty state`);
    listPersesDashboardsPage.filter.byProject('empty-namespace4');
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.removeTag('empty-namespace4');

    cy.log(`1.6. All Projects validation - Dashboard search - empty state`);
    listPersesDashboardsPage.filter.byProject('openshift-monitoring');
    listPersesDashboardsPage.emptyState();
    listPersesDashboardsPage.removeTag('openshift-monitoring');

  });

  it(`2.${perspective.name} perspective - Edit button validation - Not Editable dashboard`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2 change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`2.4. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.assertEditButtonIsDisabled();

  });

  it(`3.${perspective.name} perspective - Create button validation - Disabled`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2. Verify Create button is disabled`);
    listPersesDashboardsPage.assertCreateButtonIsDisabled();

    cy.log(`3.3 change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');

    cy.log(`3.4. Verify Create button is disabled`);
    listPersesDashboardsPage.assertCreateButtonIsDisabled();

    cy.log(`3.5. Change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.assertCreateButtonIsDisabled();

  });

  it(`4.${perspective.name} perspective - Kebab icon - Disabled`, () => {
    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`4.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');

    cy.log(`4.3. Assert Kebab icon is disabled`);
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.assertKebabIconDisabled();
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`4.4. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');

    cy.log(`4.5. Assert Kebab icon is disabled`);
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0]);
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.assertKebabIconDisabled();
    listPersesDashboardsPage.clearAllFilters();

  });

  it(`5.${perspective.name} perspective - Import button validation - Disabled`, () => {
    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`5.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');

    cy.log(`5.3. Verify Import button is disabled`);
    listPersesDashboardsPage.assertImportButtonIsDisabled();

    cy.log(`5.5. Change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.assertImportButtonIsDisabled();

    cy.log(`5.6. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');
    listPersesDashboardsPage.assertImportButtonIsDisabled();

  });

}
