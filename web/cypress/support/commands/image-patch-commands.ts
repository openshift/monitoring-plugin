import { waitForPodsReady, waitForPodsReadyOrAbsent } from './wait-utils';

export { };

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;

export const imagePatchUtils = {
  setupMonitoringPluginImage(MP: { namespace: string }): void {
    cy.log('Set Monitoring Plugin image in operator CSV');
    if (Cypress.env('MP_IMAGE')) {
      cy.exec(
        './cypress/fixtures/cmo/update-monitoring-plugin-image.sh',
        {
          env: {
            MP_IMAGE: Cypress.env('MP_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MP_NAMESPACE: `${MP.namespace}`,
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true,
        },
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO deployment Scaled Down successfully: ${result.stdout}`);
      });

      waitForPodsReady('app.kubernetes.io/name=monitoring-plugin', MP.namespace, readyTimeoutMilliseconds);
      cy.log(`Monitoring plugin pod is now running in namespace: ${MP.namespace}`);
      cy.reload(true);
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }
  },

  /**
   * Generic function to patch a component image in the COO CSV.
   */
  patchCOOCSVImage(
    MCP: { namespace: string },
    config: {
      envVar: string;
      scriptPath: string;
      componentName: string;
    },
  ): void {
    const imageValue = Cypress.env(config.envVar);
    cy.log(`Set ${config.componentName} image in operator CSV`);

    if (imageValue) {
      cy.log(`${config.envVar} is set. The image will be patched in COO operator CSV`);
      cy.exec(config.scriptPath, {
        env: {
          [config.envVar]: imageValue,
          KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
          MCP_NAMESPACE: `${MCP.namespace}`,
        },
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true,
      }).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`COO CSV updated successfully with ${config.componentName} image: ${result.stdout}`);
        cy.reload(true);
      });
    } else {
      cy.log(`${config.envVar} is NOT set. Skipping patching the image in COO operator CSV.`);
    }
  },

  setupMonitoringConsolePlugin(MCP: { namespace: string }): void {
    imagePatchUtils.patchCOOCSVImage(MCP, {
      envVar: 'MCP_CONSOLE_IMAGE',
      scriptPath: './cypress/fixtures/coo/update-mcp-image.sh',
      componentName: 'Monitoring Console Plugin',
    });
  },

  setupClusterHealthAnalyzer(MCP: { namespace: string }): void {
    imagePatchUtils.patchCOOCSVImage(MCP, {
      envVar: 'CHA_IMAGE',
      scriptPath: './cypress/fixtures/coo/update-cha-image.sh',
      componentName: 'cluster-health-analyzer',
    });
  },

  revertMonitoringPluginImage(MP: { namespace: string }): void {
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. Lets revert CMO operator CSV');
      cy.exec(
        './cypress/fixtures/cmo/reenable-monitoring.sh',
        {
          env: {
            MP_IMAGE: Cypress.env('MP_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MP_NAMESPACE: `${MP.namespace}`,
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true,
        },
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO CSV reverted successfully with Monitoring Plugin image: ${result.stdout}`);

        waitForPodsReadyOrAbsent('app.kubernetes.io/name=monitoring-plugin', MP.namespace, readyTimeoutMilliseconds);
        cy.log(`Monitoring plugin pods verified in namespace: ${MP.namespace}`);

        cy.reload(true);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping reverting the image in CMO operator CSV.');
    }
  },
};
