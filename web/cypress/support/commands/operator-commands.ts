/* eslint-disable @typescript-eslint/no-use-before-define */
import 'cypress-wait-until';
import { operatorAuthUtils } from './auth-commands';
import { cooInstallUtils } from './coo-install-commands';
import { imagePatchUtils } from './image-patch-commands';
import { dashboardsUtils } from './dashboards-commands';

export { };

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
  namespace Cypress {
    interface Chainable {
      beforeBlock(MP: { namespace: string; operatorName: string });
      cleanupMP(MP: { namespace: string; operatorName: string });
      beforeBlockCOO(
        MCP: { namespace: string; operatorName: string; packageName: string },
        MP: { namespace: string; operatorName: string },
        options?: COOSetupOptions,
      );
      cleanupCOO(
        MCP: { namespace: string; operatorName: string; packageName: string },
        MP: { namespace: string; operatorName: string },
        options?: COOSetupOptions,
      );
      RemoveClusterAdminRole();
      setupCOO(
        MCP: { namespace: string; operatorName: string; packageName: string },
        MP: { namespace: string; operatorName: string },
        options?: COOSetupOptions,
      );
      beforeBlockACM(
        MCP: { namespace: string; operatorName: string; packageName: string },
        MP: { namespace: string; operatorName: string },
      ): Chainable<void>;
      closeOnboardingModalIfPresent(): Chainable<void>;
    }
  }
}

const useSession = Cypress.env('SESSION');

// ── Helpers used only by the orchestration commands ────────────────

function removeClusterAdminRole(): void {
  cy.log('Remove cluster-admin role from user.');
  cy.executeAndDelete(
    `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
  );
}

function collectDebugInfo(MP: { namespace: string }, MCP?: { namespace: string }): void {
  if (!Cypress.env('DEBUG')) {
    cy.log('DEBUG not set. Skipping operator debug information collection.');
    return;
  }
  cy.aboutModal();
  cy.podImage('monitoring-plugin', MP.namespace);
  if (MCP && MCP.namespace) {
    cy.podImage('monitoring', MCP.namespace);
  }
}

function cleanupUIPlugin(
  MCP: { namespace: string; config?: { kind: string; name: string } },
  opts: Required<COOSetupOptions>,
): void {
  const config = MCP.config || { kind: 'UIPlugin', name: 'monitoring' };

  cy.adminCLI(
    `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
  );

  if (Cypress.env('SKIP_ALL_INSTALL')) {
    cy.log('SKIP_ALL_INSTALL is set. Skipping Monitoring UI Plugin instance deletion.');
    return;
  }

  cy.log('Delete Monitoring UI Plugin instance.');
  cy.executeAndDelete(
    `oc delete ${config.kind} ${config.name} --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
  );

  if (opts.dashboards) {
    dashboardsUtils.cleanupDashboards();
  }
  cooInstallUtils.cleanupCOONamespace(MCP);
}

// ── Cypress commands ───────────────────────────────────────────────

Cypress.Commands.add('beforeBlock', (MP: { namespace: string; operatorName: string }) => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateMPSessionKey(MP);

    cy.session(
      sessionKey,
      () => {
        cy.log('Before block (session)');
        cy.cleanupMP(MP);
        operatorAuthUtils.loginAndAuthNoSession();
        imagePatchUtils.setupMonitoringPluginImage(MP);
        collectDebugInfo(MP);
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
    cy.cleanupMP(MP);
    operatorAuthUtils.loginAndAuth();
    imagePatchUtils.setupMonitoringPluginImage(MP);
    collectDebugInfo(MP);
    cy.task('clearDownloads');
    cy.log('Before block (no session) completed');
  }
});

Cypress.Commands.add('cleanupMP', (MP: { namespace: string; operatorName: string }) => {
  if (useSession) {
    cy.log('cleanupMP (session)');
    imagePatchUtils.revertMonitoringPluginImage(MP);
    cy.log('cleanupMP (session) completed');
  }
});

Cypress.Commands.add(
  'beforeBlockCOO',
  (
    MCP: { namespace: string; operatorName: string; packageName: string },
    MP: { namespace: string; operatorName: string },
    options?: COOSetupOptions,
  ) => {
    const opts = { ...DEFAULT_COO_OPTIONS, ...options };

    if (useSession) {
      const sessionKey = [
        ...operatorAuthUtils.generateCOOSessionKey(MCP, MP),
        `dash:${opts.dashboards}`,
        `tp:${opts.troubleshootingPanel}`,
        `cha:${opts.healthAnalyzer}`,
      ];

      cy.session(
        sessionKey,
        () => {
          cy.log('Before block COO (session)');
          cy.cleanupCOO(MCP, MP, opts);
          operatorAuthUtils.loginAndAuthNoSession();
          cy.setupCOO(MCP, MP, opts);
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
      cy.cleanupCOO(MCP, MP, opts);
      operatorAuthUtils.loginAndAuth();
      cy.setupCOO(MCP, MP, opts);
      cy.log('Before block COO (no session) completed');
    }
  },
);

Cypress.Commands.add(
  'cleanupCOO',
  (
    MCP: { namespace: string; operatorName: string; packageName: string },
    MP: { namespace: string; operatorName: string },
    options?: COOSetupOptions,
  ) => {
    const opts = { ...DEFAULT_COO_OPTIONS, ...options };

    cy.log('Cleanup COO');
    if (Cypress.env('SKIP_ALL_INSTALL')) {
      cy.log('SKIP_ALL_INSTALL is set. Skipping COO cleanup and operator verifications (preserves existing setup).');
      return;
    }
    if (opts.troubleshootingPanel) {
      dashboardsUtils.cleanupTroubleshootingPanel(MCP);
    }
    cleanupUIPlugin(MCP, opts);
    imagePatchUtils.revertMonitoringPluginImage(MP);
    cy.log('Cleanup COO completed');
  },
);

Cypress.Commands.add(
  'setupCOO',
  (
    MCP: { namespace: string; operatorName: string; packageName: string },
    MP: { namespace: string; operatorName: string },
    options?: COOSetupOptions,
  ) => {
    const opts = { ...DEFAULT_COO_OPTIONS, ...options };

    if (Cypress.env('SKIP_ALL_INSTALL')) {
      cy.log('SKIP_ALL_INSTALL is set. Skipping COO setup and operator verifications (uses existing installation).');
      return;
    }
    cooInstallUtils.installCOO(MCP);
    cooInstallUtils.waitForCOOReady(MCP);
    imagePatchUtils.setupMonitoringConsolePlugin(MCP);
    if (opts.healthAnalyzer) {
      imagePatchUtils.setupClusterHealthAnalyzer(MCP);
    }
    dashboardsUtils.setupMonitoringUIPlugin(MCP);
    if (opts.dashboards) {
      dashboardsUtils.setupDashboardsAndPlugins(MCP);
    }
    if (opts.troubleshootingPanel) {
      dashboardsUtils.setupTroubleshootingPanel(MCP);
    }
    imagePatchUtils.setupMonitoringPluginImage(MP);
    removeClusterAdminRole();
    collectDebugInfo(MP, MCP);
  },
);

Cypress.Commands.add('RemoveClusterAdminRole', () => {
  cy.log('Remove cluster-admin role from user.');
  removeClusterAdminRole();
  cy.log('Remove cluster-admin role from user completed');
});

Cypress.Commands.add('beforeBlockACM', (MCP, MP) => {
  cy.beforeBlockCOO(MCP, MP);
  cy.log('=== [Setup] Installing ACM test resources ===');
  cy.exec('bash ./cypress/fixtures/coo/acm-install.sh', {
    env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH') },
    failOnNonZeroExit: false,
    timeout: 1200000,
  });
  cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-uiplugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-alerrule-test.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  cy.log('ACM environment setup completed');
});

Cypress.Commands.add('closeOnboardingModalIfPresent', () => {
  cy.get('body').then(($body) => {
    const modalSelector = 'button[data-ouia-component-id="clustersOnboardingModal-ModalBoxCloseButton"]';
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
