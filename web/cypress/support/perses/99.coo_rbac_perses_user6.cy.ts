import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import type { CustomerPerspective } from '@/shared/constants/perspective';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';

/**
 * User6 has access to:
 * - no access to any namespaces
 */
export function testCOORBACPersesTestsDevUser6(perspectiveName: CustomerPerspective) {
  it(
    `1.${perspectiveName} perspective - List Dashboards - Namespace validation and ` +
      `Dashboard search`,
    () => {
      cy.log(`1.1. Namespace validation`);
      listPersesDashboardsPage.noDashboardsFoundState();
      cy.assertNamespace('All Projects', true);
      cy.assertNamespace('openshift-monitoring', false);
      cy.assertNamespace('openshift-cluster-observability-operator', false);
      cy.assertNamespace('observ-test', false);
      cy.assertNamespace('perses-dev', false);
      cy.assertNamespace('empty-namespace3', false);
      cy.assertNamespace('empty-namespace4', false);

      cy.log(`1.2. Create button is enabled but no project is selectable, so Create is disabled`);
      listPersesDashboardsPage.assertCreateButtonIsEnabled();
      listPersesDashboardsPage.clickCreateButton();
      persesCreateDashboardsPage.createDashboardShouldBeLoaded();
      cy.byPFRole('dialog').find('button').contains('Create').should('be.disabled');
      persesCreateDashboardsPage.createDashboardDialogCancelButton();
    },
  );

  it(`2.${perspectiveName} perspective - Import button validation - Access denied`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`2.2. Verify Import button is enabled but import is disabled without a project`);
    listPersesDashboardsPage.assertImportButtonIsEnabled();
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile(
      './cypress/fixtures/coo/coo140_perses/import/testing-perses-dashboard.json',
    );
    persesImportDashboardsPage.assertPersesDashboardDetected();
    cy.byPFRole('dialog').find('button').contains('Import').should('be.disabled');
    persesImportDashboardsPage.clickCancelButton();
  });
}
