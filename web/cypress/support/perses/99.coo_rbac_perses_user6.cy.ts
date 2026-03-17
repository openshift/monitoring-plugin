import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOORBACPersesTestsDevUser6(perspective: PerspectiveConfig) {
  testCOORBACPersesTestsDevUser6(perspective);
}

/**
 * User6 has access to:
 * - no access to any namespaces
 */
export function testCOORBACPersesTestsDevUser6(perspective: PerspectiveConfig) {

  it(`1.${perspective.name} perspective - List Dashboards - Namespace validation and Dashboard search`, () => {
    cy.log(`1.1. Namespace validation`);
    listPersesDashboardsPage.noDashboardsFoundState();
    listPersesDashboardsPage.projectDropdownNotExists();

    cy.log(`1.2. Create button validation`);
    listPersesDashboardsPage.assertCreateButtonIsDisabled();
  });

  it(`2.${perspective.name} perspective - Import button validation - Disabled`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`2.2. Verify Import button is disabled`);
    listPersesDashboardsPage.assertImportButtonIsDisabled();
  });


}