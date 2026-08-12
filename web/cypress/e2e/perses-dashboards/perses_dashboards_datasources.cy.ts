import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../support/operators';
import { runCOOCreateImportPersesTests } from '../../support/perses/05.coo_create_import_perses_admin.cy';
import { nav } from '../../views/nav';

// Set constants for the operators that need to be installed for tests.

const OTEL = {
  namespace: 'openshift-opentelemetry-operator',
  packageName: 'opentelemetry-product',
  operatorName: 'Red Hat build of OpenTelemetry',
};

const TEMPO = {
  namespace: 'openshift-tempo-operator',
  packageName: 'tempo-product',
  operatorName: 'Tempo Operator',
};

const LOKI = {
  namespace: 'openshift-operators-redhat',
  packageName: 'loki-operator',
  operatorName: 'Loki Operator',
};

const CLO = {
  namespace: 'openshift-logging',
  packageName: 'cluster-logging',
  operatorName: 'Logging Operator',
};

describe(
  'COO - Dashboards (Perses) - Perses Global Datasources with Tempo and Loki',
  { tags: ['@perses-dashboards', '@coo', '@xfail'] },
  () => {
    before(() => {
      cy.beforeBlockTempo(TEMPO);
      cy.beforeBlockOtel(OTEL);
      cy.configureBase();
      cy.configureTracingApps();

      cy.beforeBlockLoki(LOKI);
      cy.beforeBlockLogging(CLO);
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
      cy.cleanupCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR, {
        dashboards: true,
        troubleshootingPanel: false,
      });
      cy.cleanupLoggingLoki();
      cy.cleanupLogging(CLO);
      cy.cleanupLoki(LOKI);
      cy.cleanupTracingApps();
      cy.cleanupBase();
      cy.cleanupOtel(OTEL);
      cy.cleanupTempo(TEMPO);
    });

    runCOOCreateImportPersesTests({
      name: 'Administrator',
    });
  },
);
