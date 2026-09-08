import { persesDashboardsPage } from '../../views/perses-dashboards';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';
import {
  persesDashboardsDashboardDropdownCOO,
  persesDashboardsDashboardDropdownPersesDev,
} from '../../fixtures/perses/constants';
import type { CustomerPerspective } from '@/shared/constants/perspective';

/**
 * User2 has access to:
 * - perses-dev: persesdashboard-viewer-role, persesdatasource-viewer-role
 * - no access to openshift-cluster-observability-operator, observ-test
 * - openshift-monitoring: view role
 */
export function testCOORBACPersesTestsDevUser2(
  perspectiveName: CustomerPerspective,
  dashboardsPageName?: string,
) {
  it(
    `1.${perspectiveName} perspective - List Dashboards - Namespace validation and ` +
      `Dashboard search`,
    () => {
      cy.log(`1.1. Namespace validation`);
      listPersesDashboardsPage.shouldBeLoaded(dashboardsPageName);
      cy.assertNamespace('All Projects', true);
      cy.assertNamespace('openshift-cluster-observability-operator', false);
      cy.assertNamespace('observ-test', false);
      cy.assertNamespace('empty-namespace3', false);
      cy.assertNamespace('empty-namespace4', false);
      cy.assertNamespace('openshift-monitoring', true);
      cy.assertNamespace('perses-dev', true);

      cy.log(
        `1.2. All Projects validation - Dashboard search - ` +
          `${persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[2]} dashboard`,
      );
      cy.changeNamespace('All Projects');
      listPersesDashboardsPage.filter.byName(
        persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
      );
      listPersesDashboardsPage.countDashboards('1');
      listPersesDashboardsPage.filter.byProject('perses-dev');
      listPersesDashboardsPage.countDashboards('1');
      listPersesDashboardsPage.removeTag(
        persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
      );
      listPersesDashboardsPage.removeTag('perses-dev');

      cy.changeNamespace('perses-dev');
      listPersesDashboardsPage.filter.byName(
        persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
      );
      listPersesDashboardsPage.countDashboards('1');
      listPersesDashboardsPage.removeTag(
        persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
      );

      cy.log(
        `1.3. All Projects validation - Dashboard search - ` +
          `${persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[2]} dashboard`,
      );
      cy.changeNamespace('All Projects');
      listPersesDashboardsPage.filter.byName(
        persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0],
      );
      listPersesDashboardsPage.emptyState();
      listPersesDashboardsPage.removeTag(
        persesDashboardsDashboardDropdownCOO.ACCELERATORS_COMMON_METRICS[0],
      );

      cy.log(
        `1.4. All Projects validation - Dashboard search - ` +
          `${persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[2]} dashboard`,
      );
      listPersesDashboardsPage.filter.byName(
        persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0],
      );
      listPersesDashboardsPage.emptyState();
      listPersesDashboardsPage.removeTag(
        persesDashboardsDashboardDropdownCOO.K8S_COMPUTE_RESOURCES_CLUSTER[0],
      );

      cy.log(`1.5. All Projects validation - Dashboard search - empty state`);
      listPersesDashboardsPage.filter.byProject('empty-namespace4');
      listPersesDashboardsPage.emptyState();
      listPersesDashboardsPage.removeTag('empty-namespace4');

      cy.log(`1.6. All Projects validation - Dashboard search - empty state`);
      listPersesDashboardsPage.filter.byProject('openshift-monitoring');
      listPersesDashboardsPage.emptyState();
      listPersesDashboardsPage.removeTag('openshift-monitoring');
    },
  );

  it(`2.${perspectiveName} perspective - Edit button validation - Not Editable dashboard`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded(dashboardsPageName);

    cy.log(`2.2 change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');
    listPersesDashboardsPage.shouldBeLoaded(dashboardsPageName);

    cy.log(`2.3. Filter by Name`);
    listPersesDashboardsPage.filter.byName(
      persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
    );
    listPersesDashboardsPage.countDashboards('1');

    cy.log(`2.4. Click on a dashboard`);
    listPersesDashboardsPage.clickDashboard(
      persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
    );
    persesDashboardsPage.shouldBeLoaded1();
    persesDashboardsPage.assertEditButtonIsDisabled();
  });

  it(`3.${perspectiveName} perspective - Create button validation - Access denied`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded(dashboardsPageName);

    cy.log(`3.2 change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');

    cy.log(`3.3. Verify Create button is enabled but creation is denied for perses-dev`);
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertCreateAccessDenied('perses-dev');
    persesCreateDashboardsPage.assertCreateAccessDenied('openshift-monitoring');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();
  });

  it(`4.${perspectiveName} perspective - Kebab icon - Row actions denied`, () => {
    cy.log(`4.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded(dashboardsPageName);

    cy.log(`4.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');

    cy.log(`4.3. Assert Rename/Delete row actions are disabled`);
    listPersesDashboardsPage.filter.byName(
      persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
    );
    listPersesDashboardsPage.assertKebabRowActionsDisabled();

    cy.log(`4.4. Assert Duplicate is blocked by access-denied in the modal`);
    listPersesDashboardsPage.assertDuplicateAccessDenied('perses-dev');
    listPersesDashboardsPage.clearAllFilters();

    cy.log(`4.5. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');

    cy.log(`4.6. Assert Rename/Delete row actions are disabled`);
    listPersesDashboardsPage.filter.byProject('perses-dev');
    listPersesDashboardsPage.filter.byName(
      persesDashboardsDashboardDropdownPersesDev.PERSES_DASHBOARD_SAMPLE[0],
    );
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.assertKebabRowActionsDisabled();
    listPersesDashboardsPage.clearAllFilters();
  });

  it(`5.${perspectiveName} perspective - Import button validation - Access denied`, () => {
    cy.log(`5.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded(dashboardsPageName);

    cy.log(`5.2. Change namespace to perses-dev`);
    cy.changeNamespace('perses-dev');

    cy.log(`5.3. Verify Import button is enabled but import is denied for perses-dev`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile(
      './cypress/fixtures/coo/coo140_perses/import/testing-perses-dashboard.json',
    );
    persesImportDashboardsPage.assertPersesDashboardDetected();
    persesImportDashboardsPage.assertImportAccessDenied('perses-dev');
    persesImportDashboardsPage.clickCancelButton();
  });
}
