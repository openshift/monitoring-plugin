import 'cypress-wait-until';
import { operatorAuthUtils } from './auth-commands';
import { cooInstallUtils } from './coo-install-commands';
import { imagePatchUtils } from './image-patch-commands';
import { dashboardsUtils } from './dashboards-commands';
import { CLUSTER_MONITORING_OPERATOR, CLUSTER_OBSERVABILITY_OPERATOR } from '../operators';

export {};

export interface COOSetupOptions {
  dashboards?: boolean;
  troubleshootingPanel?: boolean;
  healthAnalyzer?: boolean;
}

const DEFAULT_COO_OPTIONS: Required<COOSetupOptions> = {
  dashboards: true,
  troubleshootingPanel: true,
  healthAnalyzer: true,
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      ensureMonitoringPlugin();
      cleanupMP();
      ensureMonitoringConsolePlugin(options?: COOSetupOptions);
      cleanupCOO(options?: COOSetupOptions);
      RemoveClusterAdminRole();
      beforeBlockACM(): Chainable<void>;
      waitForAcmAlertsFiring(alertNames?: string[]): Chainable<void>;
      closeOnboardingModalIfPresent(): Chainable<void>;
    }
  }
}

const ACM_OBSERVABILITY_NS = 'open-cluster-management-observability';
const ACM_DEFAULT_TEST_ALERTS = ['Watchdog', 'Watchdog-spoke', 'ClusterCPUHealth-jb'];
const acmAlertReadyTimeoutMilliseconds = 600000;

const useSession = String(Cypress.env('SESSION')).toLowerCase() === 'true';

// ── Helpers used only by the orchestration commands ────────────────

function removeClusterAdminRole(): void {
  cy.log('Remove cluster-admin role from user.');
  cy.executeAndDelete(
    `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env(
      'LOGIN_USERNAME',
    )} --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
  );
}

function collectDebugInfo({
  debugMonitoringPlugin,
  debugMonitoringConsolePlugin,
}: {
  debugMonitoringPlugin?: boolean;
  debugMonitoringConsolePlugin?: boolean;
}): void {
  if (!Cypress.env('DEBUG')) {
    cy.log('DEBUG not set. Skipping operator debug information collection.');
    return;
  }
  cy.aboutModal();
  if (debugMonitoringPlugin) {
    imagePatchUtils
      .getImage('deployment/monitoring-plugin', CLUSTER_MONITORING_OPERATOR.namespace)
      .then((image) => cy.log(`Monitoring Plugin image: ${image}`));
  }
  if (debugMonitoringConsolePlugin) {
    imagePatchUtils
      .getImage('deployment/monitoring', CLUSTER_OBSERVABILITY_OPERATOR.namespace)
      .then((image) => cy.log(`Monitoring Console Plugin image: ${image}`));
  }
}

/**
 * Wait until ACM custom alert rules are evaluated and present in Alertmanager.
 * oc apply of thanos-ruler-custom-rules only updates the ConfigMap; Thanos Ruler
 * must reload/evaluate rules and push alerts to Alertmanager before the UI can show them.
 */
function waitForAcmAlertsFiring(alertNames: string[] = ACM_DEFAULT_TEST_ALERTS): void {
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
  const ns = ACM_OBSERVABILITY_NS;

  cy.log(`Waiting for ACM alerts to become firing: ${alertNames.join(', ')}`);

  cy.log('Waiting for observability-thanos-rule pods to be Ready');
  cy.adminCLI(
    `oc rollout status statefulset/observability-thanos-rule` + ` -n ${ns} --timeout=300s`,
    { failOnNonZeroExit: false, timeout: acmAlertReadyTimeoutMilliseconds },
  ).then((result) => {
    if (result.code !== 0) {
      cy.log(
        `thanos-rule rollout status not ready yet (${result.stderr || result.stdout}); ` +
          'continuing to poll Alertmanager',
      );
    }
  });

  cy.log('Waiting for ACM Alertmanager pods to be Ready');
  cy.adminCLI(
    `oc wait --for=condition=Ready pod ` +
      `-l alertmanager=observability,app=multicluster-observability-alertmanager ` +
      `-n ${ns} --timeout=300s`,
    { failOnNonZeroExit: false, timeout: acmAlertReadyTimeoutMilliseconds },
  );

  cy.waitUntil(
    () =>
      cy
        .exec(
          `POD=$(oc get pods -n ${ns} -l alertmanager=observability ` +
            `--field-selector=status.phase=Running ` +
            `-o jsonpath='{.items[0].metadata.name}' --kubeconfig "${kubeconfig}") && ` +
            `test -n "$POD" && ` +
            `(oc exec -n ${ns} "$POD" -c alertmanager --kubeconfig "${kubeconfig}" -- ` +
            `amtool alert query --alertmanager.url=http://127.0.0.1:9093 || ` +
            `oc exec -n ${ns} "$POD" -c alertmanager --kubeconfig "${kubeconfig}" -- ` +
            `wget -qO- http://127.0.0.1:9093/api/v2/alerts)`,
          { failOnNonZeroExit: false },
        )
        .then((result) => {
          if (result.code !== 0 || !result.stdout) {
            return false;
          }
          const missing = alertNames.filter((name) => !result.stdout.includes(name));
          if (missing.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`ACM alerts still missing from Alertmanager: ${missing.join(', ')}`);
            return false;
          }
          // eslint-disable-next-line no-console
          console.log(`All expected ACM alerts found in Alertmanager: ${alertNames.join(', ')}`);
          return true;
        }),
    {
      timeout: acmAlertReadyTimeoutMilliseconds,
      interval: 15000,
      errorMsg:
        `Timed out waiting for ACM alerts to fire in Alertmanager: ${alertNames.join(', ')}. ` +
        'ConfigMap may be applied but Thanos Ruler has not evaluated/pushed the alerts yet.',
    },
  );
}

function cleanupUIPlugin(opts: Required<COOSetupOptions>): void {
  const config = CLUSTER_OBSERVABILITY_OPERATOR.config || { kind: 'UIPlugin', name: 'monitoring' };

  cy.adminCLI(
    `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
  );

  if (Cypress.env('SKIP_ALL_INSTALL')) {
    cy.log('SKIP_ALL_INSTALL is set. Skipping Monitoring UI Plugin instance deletion.');
    return;
  }

  cy.log('Delete Monitoring UI Plugin instance.');
  cy.executeAndDelete(
    `oc delete ${config.kind} ${config.name} --ignore-not-found --kubeconfig ${Cypress.env(
      'KUBECONFIG_PATH',
    )}`,
  );

  if (opts.dashboards) {
    dashboardsUtils.cleanupDashboards();
  }
  cooInstallUtils.cleanupCOONamespace();
}

// ── Cypress commands ───────────────────────────────────────────────

Cypress.Commands.add('ensureMonitoringPlugin', () => {
  cy.log('Ensure Monitoring Plugin');
  operatorAuthUtils.loginAndAuth();
  imagePatchUtils.setupMonitoringPluginImage();
  collectDebugInfo({ debugMonitoringPlugin: true, debugMonitoringConsolePlugin: false });
  cy.task('clearDownloads');
  cy.log('Ensure Monitoring Plugin completed');
});

Cypress.Commands.add('cleanupMP', () => {
  if (useSession) {
    cy.log('cleanupMP (session)');
    imagePatchUtils.revertMonitoringPluginImage();
    cy.log('cleanupMP (session) completed');
  }
});

Cypress.Commands.add('ensureMonitoringConsolePlugin', (options?: COOSetupOptions) => {
  const opts = { ...DEFAULT_COO_OPTIONS, ...options };

  if (useSession) {
    const sessionKey = [
      ...operatorAuthUtils.generateCOOSessionKey(),
      `dash:${opts.dashboards}`,
      `tp:${opts.troubleshootingPanel}`,
      `cha:${opts.healthAnalyzer}`,
    ];

    cy.session(
      sessionKey,
      () => {
        operatorAuthUtils.loginAndAuthNoSession();
      },
      {
        cacheAcrossSpecs: true,
        validate: () => {
          cy.validateLogin();
        },
      },
    );
  } else {
    operatorAuthUtils.loginAndAuth();
  }

  if (Cypress.env('SKIP_ALL_INSTALL')) {
    cy.log('SKIP_ALL_INSTALL is set. Skipping Monitoring Console Plugin reconciliation.');
    return;
  }

  cy.log('Ensure Monitoring Console Plugin');
  cy.adminCLI(
    `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
  );
  cooInstallUtils.ensureCOOInstalled();
  cooInstallUtils.waitForCOOReady();
  cooInstallUtils.enableOpenShiftMode();
  imagePatchUtils.setupMonitoringConsolePlugin();
  if (opts.healthAnalyzer) {
    imagePatchUtils.setupClusterHealthAnalyzer();
  }
  dashboardsUtils.setupMonitoringUIPlugin();
  imagePatchUtils.verifyMonitoringConsolePluginImage();
  if (opts.healthAnalyzer) {
    imagePatchUtils.verifyClusterHealthAnalyzerImage();
  }
  if (opts.dashboards) {
    dashboardsUtils.setupDashboardsAndPlugins();
  }
  if (opts.troubleshootingPanel) {
    dashboardsUtils.setupTroubleshootingPanel();
  }
  imagePatchUtils.setupMonitoringPluginImage();
  removeClusterAdminRole();
  collectDebugInfo({ debugMonitoringPlugin: true, debugMonitoringConsolePlugin: true });
  cy.log('Ensure Monitoring Console Plugin completed');
});

Cypress.Commands.add('cleanupCOO', (options?: COOSetupOptions) => {
  const opts = { ...DEFAULT_COO_OPTIONS, ...options };

  cy.log('Cleanup COO');
  if (Cypress.env('SKIP_ALL_INSTALL')) {
    cy.log(
      'SKIP_ALL_INSTALL is set. Skipping COO cleanup and operator verifications (preserves existing setup).',
    );
    return;
  }
  if (opts.troubleshootingPanel) {
    dashboardsUtils.cleanupTroubleshootingPanel();
  }
  cleanupUIPlugin(opts);
  imagePatchUtils.revertMonitoringPluginImage();
  cy.log('Cleanup COO completed');
});

Cypress.Commands.add('RemoveClusterAdminRole', () => {
  cy.log('Remove cluster-admin role from user.');
  removeClusterAdminRole();
  cy.log('Remove cluster-admin role from user completed');
});

Cypress.Commands.add('waitForAcmAlertsFiring', (alertNames?: string[]) => {
  waitForAcmAlertsFiring(alertNames);
});

Cypress.Commands.add('beforeBlockACM', () => {
  cy.ensureMonitoringConsolePlugin();
  cy.log('=== [Setup] Installing ACM test resources ===');
  cy.exec('bash ./cypress/fixtures/shared/fleet-management/fleet-management-install.sh', {
    env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH') },
    failOnNonZeroExit: false,
    timeout: 1200000,
  });
  cy.adminCLI(
    `oc apply -f ./cypress/fixtures/shared/fleet-management/fleet-management-uiplugin.yaml`,
  );
  cy.adminCLI(
    `oc apply -f ./cypress/fixtures/shared/fleet-management/fleet-management-alertrule-test.yaml`,
  );
  cy.waitForAcmAlertsFiring(ACM_DEFAULT_TEST_ALERTS);
  cy.log('ACM environment setup completed');
});

Cypress.Commands.add('closeOnboardingModalIfPresent', () => {
  cy.get('body').then(($body) => {
    const modalSelector =
      'button[data-ouia-component-id="clustersOnboardingModal-ModalBoxCloseButton"]';
    if ($body.find(modalSelector).length > 0) {
      cy.log('Onboarding modal detected, attempting to close...');
      cy.get(modalSelector, { timeout: 20000 })
        .should('be.visible')
        .should('not.be.disabled')
        .click({ force: true });

      cy.get(modalSelector, { timeout: 10000 })
        .should('not.exist')
        .then(() => cy.log('Modal successfully closed'));
    } else {
      cy.log('No onboarding modal found');
    }
  });
});
