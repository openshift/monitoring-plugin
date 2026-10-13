import { listPersesDashboardsPage } from '../../views/perses-dashboards-list-dashboards';
import { persesDashboardsPage } from '../../views/perses-dashboards';
import { persesDashboardsAddListPanelType } from '../../fixtures/perses/constants';
import { persesCreateDashboardsPage } from '../../views/perses-dashboards-create-dashboard';
import { persesDashboardsPanelGroup } from '../../views/perses-dashboards-panelgroup';
import { persesDashboardsPanel } from '../../views/perses-dashboards-panel';
import { persesImportDashboardsPage } from '../../views/perses-dashboards-import-dashboard';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runCOOCreateImportPersesTests(perspective: PerspectiveConfig) {
  testCOOCreateImportPerses(perspective);
}

export function testCOOCreateImportPerses(perspective: PerspectiveConfig) {
  it(
    `1.${perspective.name} perspective - Create Dashboard with Tempo and Loki Global Datasources ` +
      `and variables`,
    () => {
      let dashboardName = 'Tempo Loki Perses Global Datasources ';
      const randomSuffix = Math.random().toString(5);
      dashboardName += randomSuffix;
      cy.log(`1.1. use sidebar nav to go to Observe > Dashboards (Perses)`);
      listPersesDashboardsPage.shouldBeLoaded();

      cy.log(`1.2. Click on Create button`);
      listPersesDashboardsPage.clickCreateButton();
      persesCreateDashboardsPage.createDashboardShouldBeLoaded();

      cy.log(`1.3. Create Dashboard`);
      persesCreateDashboardsPage.selectProject('default');
      persesCreateDashboardsPage.enterDashboardName(dashboardName);
      persesCreateDashboardsPage.createDashboardDialogCreateButton();
      persesDashboardsPage.shouldBeLoadedEditionMode(dashboardName);
      persesDashboardsPage.shouldBeLoadedEditionModeFromCreateDashboard();

      // cy.log(`1.4. Turn off Auto Refresh`);
      // persesDashboardsPage.clickRefreshIntervalDropdown(persesDashboardsRefreshInterval.OFF);

      cy.log(`1.5. Add Panel Group`);
      persesDashboardsPage.clickEditActionButton('AddGroup');
      persesDashboardsPanelGroup.addPanelGroup('Panel Group Up', 'Open', '');

      cy.log(`1.6. Add Panel - Tempo Scatter Chart`);
      persesDashboardsPage.clickEditActionButton('AddPanel');
      persesDashboardsPanel.addPanelShouldBeLoaded();
      persesDashboardsPanel.addPanel(
        'Tempo - Scatter Chart',
        'Panel Group Up',
        persesDashboardsAddListPanelType.SCATTER_CHART,
        'This is a scatter chart test',
        '{}',
      );

      cy.log(`1.7. Add Panel - Tempo Trace Table`);
      persesDashboardsPage.clickEditActionButton('AddPanel');
      persesDashboardsPanel.addPanelShouldBeLoaded();
      persesDashboardsPanel.addPanel(
        'Tempo - Trace Table',
        'Panel Group Up',
        persesDashboardsAddListPanelType.TRACE_TABLE,
        'This is a trace table test',
        '{}',
      );

      cy.log(`1.8. Add Panel - Loki Logs Table`);
      persesDashboardsPage.clickEditActionButton('AddPanel');
      persesDashboardsPanel.addPanelShouldBeLoaded();
      persesDashboardsPanel.addPanel(
        'Loki - Logs Table',
        'Panel Group Up',
        persesDashboardsAddListPanelType.LOGS_TABLE,
        'This is a logs table test',
        '{ log_type="application" } | json',
      );

      cy.log(`1.9. Add Panel - Time Series Chart`);
      persesDashboardsPage.clickEditActionButton('AddPanel');
      persesDashboardsPanel.addPanelShouldBeLoaded();
      persesDashboardsPanel.addPanel(
        'Time Series Chart',
        'Panel Group Up',
        persesDashboardsAddListPanelType.TIME_SERIES_CHART,
        'This is a line chart test',
        'up',
      );
      persesDashboardsPage.clickEditActionButton('Save');
      persesDashboardsPage.assertScatterChartPanel();
      persesDashboardsPage.assertTraceTablePanel();
      persesDashboardsPage.assertLogsTablePanel();
    },
  );

  it(`2. ${perspective.name} perspective - Import Dashboard - Perses dashboard - JSON file`, () => {
    cy.log(`2.1 use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`2.2 Click on Import button`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();

    cy.log(`2.3 Upload Perses dashboard JSON file`);
    persesImportDashboardsPage.uploadFile(
      './cypress/fixtures/coo/coo140_perses/import/tempo_loki_thanos.json',
    );
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`2.4 Select a project`);
    persesImportDashboardsPage.selectProject('default');

    cy.log(`2.5 Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeAlert();

    cy.log(`2.6 Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode(
      'Tempo Loki Perses Global Datasources - JSON Import',
    );
    persesDashboardsPage.assertScatterChartPanel();
    persesDashboardsPage.assertTraceTablePanel();
    persesDashboardsPage.assertLogsTablePanel();
  });

  it(`3. ${perspective.name} perspective - Import Dashboard - Perses dashboard - YAML file`, () => {
    cy.log(`3.1 use sidebar nav to go to Observe > Dashboards (Perses)`);
    listPersesDashboardsPage.shouldBeLoaded();

    cy.log(`3.2 Click on Import button`);
    listPersesDashboardsPage.clickImportButton();
    persesImportDashboardsPage.importDashboardShouldBeLoaded();

    cy.log(`3.3 Upload Perses dashboard YAML file`);
    persesImportDashboardsPage.uploadFile(
      './cypress/fixtures/coo/coo140_perses/import/tempo_loki_thanos.yaml',
    );
    persesImportDashboardsPage.assertPersesDashboardDetected();

    cy.log(`3.4 Select a project`);
    persesImportDashboardsPage.selectProject('default');

    cy.log(`3.5 Import dashboard`);
    persesImportDashboardsPage.clickImportFileButton();
    persesDashboardsPage.closeAlert();

    cy.log(`3.6 Assert dashboard is imported`);
    persesDashboardsPage.shouldBeLoadedEditionMode(
      'Tempo Loki Perses Global Datasources - YAML Import',
    );
    persesDashboardsPage.assertScatterChartPanel();
    persesDashboardsPage.assertTraceTablePanel();
    persesDashboardsPage.assertLogsTablePanel();
  });
}
