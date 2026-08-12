import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import {
  CLUSTER_LOGGING_OPERATOR,
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  LOKI_OPERATOR,
  OPENTELEMETRY_OPERATOR,
  TEMPO_OPERATOR,
} from '../../support/shared/operators';
import { testCOOCreateImportPerses } from '../../support/perses/perses_create_import_admin.cy';
import { nav } from '../../views/shared/nav';

describe(
  'COO - Dashboards (Perses) - Perses Global Datasources with Tempo and Loki',
  { tags: ['@perses-dashboards', '@coo', '@xfail'] },
  () => {
    before(() => {
      cy.beforeBlockTempo(TEMPO_OPERATOR);
      cy.beforeBlockOtel(OPENTELEMETRY_OPERATOR);
      cy.configureBase();
      cy.configureTracingApps();

      cy.beforeBlockLoki(LOKI_OPERATOR);
      cy.beforeBlockLogging(CLUSTER_LOGGING_OPERATOR);
      cy.configureLoggingLoki();

      cy.cleanupDistributeTracingUIPlugin();
      cy.cleanupLoggingUIPlugin();
      cy.cleanupExtraDashboards();

      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR, {
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
      cy.cleanupCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR, {
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupLoggingLoki();
      cy.cleanupLogging(CLUSTER_LOGGING_OPERATOR);
      cy.cleanupLoki(LOKI_OPERATOR);
      cy.cleanupTracingApps();
      cy.cleanupBase();
      cy.cleanupOtel(OPENTELEMETRY_OPERATOR);
      cy.cleanupTempo(TEMPO_OPERATOR);
    });

    testCOOCreateImportPerses(CustomerPerspectiveName.CorePlatform);
  },
);
