import { listPersesDashboardsPage } from "../../views/perses-dashboards-list-dashboards";
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesImportDashboardsPage } from "../../views/perses-dashboards-import-dashboard";
import { nav } from "../../views/nav";

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOImportPersesTests(perspective: PerspectiveConfig) {
  testCOOImportPerses(perspective);
}

export function testCOOImportPerses(perspective: PerspectiveConfig) {

  it(`1. ${perspective.name} perspective - Import Dashboard - wrong format`, () => {
    cy.log(`1.1 use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`1.2 Click on Import button`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();

    cy.log(`1.3 Upload wrong format file`);
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/accelerators-dashboard-cr-v1alpha1.yaml');
    persesImportDashboardsPage.assertUnableToDetectDashboardFormat();

    cy.log(`1.4 Clear file`);
    persesImportDashboardsPage.clickClearFileButton();
    
    cy.log(`1.5 Upload another wrong format file`);
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/accelerators-dashboard-cr-v1alpha2.yaml');
    persesImportDashboardsPage.assertUnableToDetectDashboardFormat(); 

    cy.log(`1.6 Clear file`);
    persesImportDashboardsPage.clickClearFileButton();

    cy.log(`1.7 Upload Grafana dashboard file`);
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/grafana_to_check_errors.json');
    persesImportDashboardsPage.assertGrafanaDashboardDetected();

    cy.log(`1.8 Select a project`);
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');

    cy.log(`1.9 Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();

    cy.log(`1.10 Assert failed to migrate Grafana dashboard`);
    persesImportDashboardsPage.assertFailedToMigrateGrafanaDashboard();
    
    cy.log(`1.11 Cancel import`);
    persesImportDashboardsPage.clickCancelButton();

  });

  it(`2. ${perspective.name} perspective - Import Dashboard - ACM Grafana dashboard`, () => {
    cy.log(`2.1 use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2 Click on Import button`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();

    cy.log(`2.3 Upload Grafana dashboard file`);
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/acm-vm-status.json');
    persesImportDashboardsPage.assertGrafanaDashboardDetected();

    cy.log(`2.4 Select a project`);
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');

    cy.log(`2.5 Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeSuccessAlert();

    cy.log(`2.6 Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode('Service Level dashboards / Virtual Machines by Time in Status');

    cy.log(`2.7 Back to list of dashboards`);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`2.8 Filter by Name`);
    listPersesDashboardsPage.filter.byName('Service Level dashboards / Virtual Machines by Time in Status');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clearAllFilters();
    cy.wait(2000);

    cy.log(`2.9 Import the same dashboard - Duplicated error`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/acm-vm-status.json');
    persesImportDashboardsPage.assertGrafanaDashboardDetected();
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesImportDashboardsPage.clickImportFileButton();
    persesImportDashboardsPage.assertDuplicatedDashboardError();
    persesImportDashboardsPage.clickCancelButton();

  });

  it(`3. ${perspective.name} perspective - Import Dashboard - Perses dashboard - JSON file`, () => {
    cy.log(`3.1 use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2 Click on Import button`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();

    cy.log(`3.3 Upload Perses dashboard JSON file`);
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.json');
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`3.4 Select a project`);
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');

    cy.log(`3.5 Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeSuccessAlert();

    cy.log(`3.6 Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode('Testing Perses dashboard - JSON');

    cy.log(`3.7 Back to list of dashboards`);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`3.8 Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - JSON');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clearAllFilters();
    cy.wait(2000);

    cy.log(`3.9 Import the same dashboard - Duplicated error`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.json');
    persesImportDashboardsPage.assertPersesDashboardDetected();
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesImportDashboardsPage.clickImportFileButton();
    persesImportDashboardsPage.assertDuplicatedDashboardError();
    persesImportDashboardsPage.clickCancelButton();

  });

  it(`4. ${perspective.name} perspective - Import Dashboard - Perses dashboard - YAML file`, () => {
    cy.log(`4.1 use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`4.2 Click on Import button`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();

    cy.log(`4.3 Upload Perses dashboard YAML file`);
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.yaml');
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`4.4 Select a project`);
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');

    cy.log(`4.5 Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeSuccessAlert();

    cy.log(`4.6 Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode('Testing Perses dashboard - YAML');

    cy.log(`4.7 Back to list of dashboards`);
    persesDashboardsPage.backToListPersesDashboardsPage();

    cy.log(`4.8 Filter by Name`);
    listPersesDashboardsPage.filter.byName('Testing Perses dashboard - YAML');
    listPersesDashboardsPage.countDashboards('1');
    listPersesDashboardsPage.clearAllFilters();
    cy.wait(2000);
    
    cy.log(`4.9 Import the same dashboard - Duplicated error`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();
    persesImportDashboardsPage.uploadFile('./cypress/fixtures/coo/coo141_perses/import/testing-perses-dashboard.yaml');
    persesImportDashboardsPage.assertPersesDashboardDetected();
    persesImportDashboardsPage.selectProject('openshift-cluster-observability-operator');
    persesImportDashboardsPage.clickImportFileButton();
    persesImportDashboardsPage.assertDuplicatedDashboardError();
    persesImportDashboardsPage.clickCancelButton();

  });

  it(`5. ${perspective.name} perspective - Delete imported dashboard`, () => {
    const dashboardsToDelete = [
      'Testing Perses dashboard - JSON',
      'Testing Perses dashboard - YAML',
      'Service Level dashboards / Virtual Machines by Time in Status'
    ];

    cy.log(`5.1 Navigate to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    dashboardsToDelete.forEach((dashboardName, index) => {
      cy.log(`5.${index + 2}.1 Filter by Name: ${dashboardName}`);
      listPersesDashboardsPage.filter.byName(dashboardName);
      listPersesDashboardsPage.countDashboards('1');
      cy.wait(2000);

      cy.log(`5.${index + 2}.2 Delete dashboard via Kebab menu`);
      listPersesDashboardsPage.clickKebabIcon();
      listPersesDashboardsPage.clickDeleteOption();
      listPersesDashboardsPage.deleteDashboardDeleteButton();
      listPersesDashboardsPage.emptyState();
      listPersesDashboardsPage.countDashboards('0');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);

      cy.log(`5.${index + 2}.3 Verify dashboard is deleted`);
      listPersesDashboardsPage.filter.byName(dashboardName);
      listPersesDashboardsPage.countDashboards('0');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    });
  });
}
