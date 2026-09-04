import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import type { CustomerPerspective } from '@/shared/constants/perspective';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';

/**
 * User4 has access to:
 * - empty-namespace4: persesdashboard-viewer-role, persesdatasource-viewer-role
 * - no access to openshift-cluster-observability-operator, observ-test, perses-dev,
 *   empty-namespace3
 * - openshift-monitoring: view role
 */
export function testCOORBACPersesTestsDevUser4(perspectiveName: CustomerPerspective) {
  it(
    `1.${perspectiveName} perspective - List Dashboards - Namespace validation and ` +
      `Dashboard search`,
    () => {
      cy.log(`1.1. Namespace validation`);
      listPersesDashboardsPage.noDashboardsFoundState();
      cy.assertNamespace('All Projects', true);
      cy.assertNamespace('openshift-cluster-observability-operator', false);
      cy.assertNamespace('observ-test', false);
      cy.assertNamespace('perses-dev', false);
      cy.assertNamespace('empty-namespace3', false);
      cy.assertNamespace('empty-namespace4', true);
      cy.assertNamespace('openshift-monitoring', true);

      cy.log(`1.2. All Projects validation - Dashboard search - empty state`);
      cy.changeNamespace('All Projects');
      listPersesDashboardsPage.noDashboardsFoundState();
      listPersesDashboardsPage.assertCreateButtonIsEnabled();

      cy.log(`1.3. empty-namespace4 validation - Dashboard search - empty state`);
      cy.changeNamespace('empty-namespace4');
      listPersesDashboardsPage.noDashboardsFoundState();
      listPersesDashboardsPage.assertCreateButtonIsEnabled();

      cy.log(`1.4. openshift-monitoring validation - Dashboard search - empty state`);
      cy.changeNamespace('openshift-monitoring');
      listPersesDashboardsPage.noDashboardsFoundState();
      listPersesDashboardsPage.assertCreateButtonIsEnabled();
    },
  );

  it(`2.${perspectiveName} perspective - Create button validation - Access denied`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`2.2 change namespace to empty-namespace4`);
    cy.changeNamespace('empty-namespace4');

    cy.log(`2.3. Verify Create button is enabled but creation is denied for empty-namespace4`);
    listPersesDashboardsPage.assertCreateButtonIsEnabled();
    listPersesDashboardsPage.clickCreateButton();
    persesCreateDashboardsPage.createDashboardShouldBeLoaded();
    persesCreateDashboardsPage.assertCreateAccessDenied('empty-namespace4');
    persesCreateDashboardsPage.createDashboardDialogCancelButton();
  });

  it(`3.${perspectiveName} perspective - Import button validation - Access denied`, () => {
    cy.log(`3.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`3.2 change namespace to empty-namespace4`);
    cy.changeNamespace('empty-namespace4');

    cy.log(`3.3. Verify Import button is enabled but import is denied for empty-namespace4`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile(
      './cypress/fixtures/coo/coo140_perses/import/testing-perses-dashboard.json',
    );
    persesImportDashboardsPage.assertPersesDashboardDetected();
    persesImportDashboardsPage.assertImportAccessDenied('empty-namespace4');
    persesImportDashboardsPage.clickCancelButton();
  });
}
