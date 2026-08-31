import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import type { CustomerPerspective } from '@/shared/constants/perspective';

export function runCOORBACPersesTestsDevUser6(perspective: CustomerPerspective) {
  testCOORBACPersesTestsDevUser6(perspective);
}

/**
 * User6 has access to:
 * - no access to any namespaces
 */
function testCOORBACPersesTestsDevUser6(perspectiveName: CustomerPerspective) {
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

      cy.log(`1.2. Create button validation`);
      listPersesDashboardsPage.assertCreateButtonIsDisabled();
    },
  );

  it(`2.${perspectiveName} perspective - Import button validation - Disabled`, () => {
    cy.log(`2.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.noDashboardsFoundState();

    cy.log(`2.2. Verify Import button is disabled`);
    listPersesDashboardsPage.assertImportButtonIsDisabled();
  });
}
