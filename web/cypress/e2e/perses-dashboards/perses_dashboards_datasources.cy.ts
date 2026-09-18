import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testCOOCreateImportPerses } from '../../support/perses/perses_create_import_admin.cy';
import { nav } from '../../views/nav';

describe(
  'COO - Dashboards (Perses) - Perses Global Datasources with Tempo and Loki',
  { tags: ['@perses-dashboards', '@coo', '@xfail'] },
  () => {
    before(() => {
      cy.beforeBlockTempo();
      cy.beforeBlockOtel();
      cy.configureBase();
      cy.configureTracingApps();

      cy.beforeBlockLoki();
      cy.beforeBlockLogging();
      cy.configureLoggingLoki();

      cy.cleanupDistributeTracingUIPlugin();
      cy.cleanupLoggingUIPlugin();
      cy.cleanupExtraDashboards();

      cy.ensureMonitoringConsolePlugin({
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesExtraDashboards();
      cy.installDistributeTracingUIPlugin();
      cy.installLoggingUIPlugin();
      cy.waitForDistributeTracingUIPluginReady();
      cy.waitForLoggingUIPluginReady();

      cy.createGlobalDatasources();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    after(() => {
      cy.cleanupGlobalDatasources();
      cy.cleanupLoggingUIPlugin();
      cy.cleanupDistributeTracingUIPlugin();
      cy.cleanupExtraDashboards();
      cy.cleanupCOO({
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupLoggingLoki();
      cy.cleanupLogging();
      cy.cleanupLoki();
      cy.cleanupTracingApps();
      cy.cleanupBase();
      cy.cleanupOtel();
      cy.cleanupTempo();
    });

    testCOOCreateImportPerses(CustomerPerspectiveName.CorePlatform);
  },
);
