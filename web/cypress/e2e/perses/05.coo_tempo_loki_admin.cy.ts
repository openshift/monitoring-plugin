import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { CLUSTER_LOGGING_OPERATOR, LOKI_OPERATOR, TEMPO_OPERATOR } from '../../support/operators';
import { testCOOCreateImportPerses } from '../../support/perses/05.coo_create_import_perses_admin.cy';
import { nav } from '../../views/nav';

describe(
  'COO - Dashboards (Perses) - Perses Global Datasources with Tempo and Loki',
  { tags: ['@perses-dashboards', '@coo', '@xfail'] },
  () => {
    before(() => {
      cy.beforeBlockTempo(TEMPO_OPERATOR);
      cy.beforeBlockOtel();
      cy.configureBase();
      cy.configureTracingApps();

      cy.beforeBlockLoki(LOKI_OPERATOR);
      cy.beforeBlockLogging(CLUSTER_LOGGING_OPERATOR);
      cy.configureLoggingLoki();

      cy.cleanupDistributeTracingUIPlugin();
      cy.cleanupLoggingUIPlugin();
      cy.cleanupExtraDashboards();

      cy.beforeBlockCOO({
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupPersesTestDashboardsBeforeTests();
      cy.setupPersesExtraDashboards();
      cy.installDistributeTracingUIPlugin();
      cy.installLoggingUIPlugin();
      cy.waitForDistributeTracingUIPluginReady();
      cy.waitForLoggingUIPluginReady();

      cy.createTempoLokiThanosPersesGlobalDatasource();
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
      cy.wait(5000);
      cy.changeNamespace('All Projects');
    });

    after(() => {
      cy.cleanupTempoLokiThanosPersesGlobalDatasource();
      cy.cleanupLoggingUIPlugin();
      cy.cleanupDistributeTracingUIPlugin();
      cy.cleanupExtraDashboards();
      cy.cleanupCOO({
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupLoggingLoki();
      cy.cleanupLogging(CLUSTER_LOGGING_OPERATOR);
      cy.cleanupLoki(LOKI_OPERATOR);
      cy.cleanupTracingApps();
      cy.cleanupBase();
      cy.cleanupOtel();
      cy.cleanupTempo(TEMPO_OPERATOR);
    });

    testCOOCreateImportPerses(CustomerPerspectiveName.CorePlatform);
  },
);
