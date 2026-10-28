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
      beforeBlock();
      cleanupMP();
      beforeBlockCOO(options?: COOSetupOptions);
      cleanupCOO(options?: COOSetupOptions);
      RemoveClusterAdminRole();
      setupCOO(options?: COOSetupOptions);
      waitForAcmAlertsFiring(alertNames?: string[]): Chainable<void>;
      closeOnboardingModalIfPresent(): Chainable<void>;
    }
  }
}

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
    cy.podImage('monitoring-plugin', CLUSTER_MONITORING_OPERATOR.namespace);
  }
  if (debugMonitoringConsolePlugin) {
    cy.podImage('monitoring', CLUSTER_OBSERVABILITY_OPERATOR.namespace);
  }
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

Cypress.Commands.add('beforeBlock', () => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateMPSessionKey();

    cy.session(
      sessionKey,
      () => {
        cy.log('Before block (session)');
        cy.cleanupMP();
        operatorAuthUtils.loginAndAuthNoSession();
        imagePatchUtils.setupMonitoringPluginImage();
        collectDebugInfo({ debugMonitoringPlugin: true });
        cy.task('clearDownloads');
        cy.log('Before block (session) completed');
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
        },
      },
    );
  } else {
    cy.log('Before block (no session)');
    cy.cleanupMP();
    operatorAuthUtils.loginAndAuth();
    imagePatchUtils.setupMonitoringPluginImage();
    collectDebugInfo({ debugMonitoringPlugin: true });
    cy.task('clearDownloads');
    cy.log('Before block (no session) completed');
  }
});

Cypress.Commands.add('cleanupMP', () => {
  if (useSession) {
    cy.log('cleanupMP (session)');
    imagePatchUtils.revertMonitoringPluginImage();
    cy.log('cleanupMP (session) completed');
  }
});

Cypress.Commands.add('beforeBlockCOO', (options?: COOSetupOptions) => {
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
        cy.log('Before block COO (session)');
        cy.cleanupCOO(opts);
        operatorAuthUtils.loginAndAuthNoSession();
        cy.setupCOO(opts);
        cy.log('Before block COO (session) completed');
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
          if (opts.dashboards) {
            cy.visit('/monitoring/v2/dashboards');
            cy.url().should('include', '/monitoring/v2/dashboards');
          }
        },
      },
    );
  } else {
    cy.log('Before block COO (no session)');
    cy.cleanupCOO(opts);
    operatorAuthUtils.loginAndAuth();
    cy.setupCOO(opts);
    cy.log('Before block COO (no session) completed');
  }
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

  cleanupUIPlugin(opts);
  imagePatchUtils.revertMonitoringPluginImage();
  cy.log('Cleanup COO completed');
});

Cypress.Commands.add('setupCOO', (options?: COOSetupOptions) => {
  const opts = { ...DEFAULT_COO_OPTIONS, ...options };

  if (Cypress.env('SKIP_ALL_INSTALL')) {
    cy.log(
      'SKIP_ALL_INSTALL is set. Skipping COO setup and operator verifications (uses existing installation).',
    );
    return;
  }
  cooInstallUtils.installCOO();
  cooInstallUtils.waitForCOOReady();
  cooInstallUtils.enableOpenShiftMode();
  imagePatchUtils.setupMonitoringConsolePlugin();
  dashboardsUtils.setupMonitoringUIPlugin();
  imagePatchUtils.verifyMonitoringConsolePluginImage();
  if (opts.dashboards) {
    dashboardsUtils.setupDashboardsAndPlugins();
  }
  imagePatchUtils.setupMonitoringPluginImage();
  removeClusterAdminRole();
  collectDebugInfo({ debugMonitoringPlugin: true, debugMonitoringConsolePlugin: true });
});

Cypress.Commands.add('RemoveClusterAdminRole', () => {
  cy.log('Remove cluster-admin role from user.');
  removeClusterAdminRole();
  cy.log('Remove cluster-admin role from user completed');
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
