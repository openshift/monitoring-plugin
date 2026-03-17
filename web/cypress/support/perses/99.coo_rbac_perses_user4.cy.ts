import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';
import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOORBACPersesTestsDevUser4(perspective: PerspectiveConfig) {
  testCOORBACPersesTestsDevUser4(perspective);
}

/**
 * User4 has access to:
 * - empty-namespace4 namespace as persesdashboard-viewer-role and persesdatasource-viewer-role
 * - no access to openshift-cluster-observability-operator, observ-test, perses-dev namespaces, empty-namespace3 namespaces
 * - openshift-monitoring namespace as view role
 */
export function testCOORBACPersesTestsDevUser4(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards - Namespace validation and Dashboard search`, () => {
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
    listPersesDashboardsPage.assertCreateButtonIsDisabled();

    cy.log(`1.3. empty-namespace4 validation - Dashboard search - empty state`);
    cy.changeNamespace('empty-namespace4');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsDisabled();

    cy.log(`1.4. openshift-monitoring validation - Dashboard search - empty state`);
    cy.changeNamespace('openshift-monitoring');
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.assertCreateButtonIsDisabled();

  });

  it(`2.${perspective.name} perspective - Import button validation - Disabled`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`2.2 change namespace to empty-namespace4`);
    cy.changeNamespace('empty-namespace4');
    
    cy.log(`2.3. Verify Import button is disabled`);
    listPersesDashboardsPage.assertImportButtonIsDisabled();

    cy.log(`2.4. Change namespace to openshift-monitoring`);
    cy.changeNamespace('openshift-monitoring');
    cy.log(`2.5. Verify Import button is disabled`);
    listPersesDashboardsPage.assertImportButtonIsDisabled();
    
    cy.log(`2.6. Change namespace to All Projects`);
    cy.changeNamespace('All Projects');
    cy.log(`2.7. Verify Import button is disabled`);
    listPersesDashboardsPage.assertImportButtonIsDisabled();
    
  });


}