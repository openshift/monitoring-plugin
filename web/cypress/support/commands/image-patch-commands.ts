import { waitForPodsReady, waitForPodsReadyOrAbsent } from './wait-utils';

export {};

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;

export const imagePatchUtils = {
  setupMonitoringPluginImage(CLUSTER_MONITORING_OPERATOR: { namespace: string }): void {
    cy.log('Set Monitoring Plugin image in operator CSV');
    if (Cypress.env('MP_IMAGE')) {
      cy.exec(
        './cypress/fixtures/shared/cluster-monitoring-operator/update-monitoring-plugin-image.sh',
        {
          env: {
            MP_IMAGE: Cypress.env('MP_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MP_NAMESPACE: `${CLUSTER_MONITORING_OPERATOR.namespace}`,
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true,
        },
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO deployment Scaled Down successfully: ${result.stdout}`);
      });

      waitForPodsReady(
        'app.kubernetes.io/name=monitoring-plugin',
        CLUSTER_MONITORING_OPERATOR.namespace,
        readyTimeoutMilliseconds,
      );
      cy.log(
        `Monitoring plugin pod is now running in namespace: ` +
          `${CLUSTER_MONITORING_OPERATOR.namespace}`,
      );
      cy.reload(true);
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }
  },

  /**
   * Generic function to patch a component image in the COO CSV.
   */
  patchCOOCSVImage(
    CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string },
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
          MCP_NAMESPACE: `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
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

  setupMonitoringConsolePlugin(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    imagePatchUtils.patchCOOCSVImage(CLUSTER_OBSERVABILITY_OPERATOR, {
      envVar: 'MCP_CONSOLE_IMAGE',
      scriptPath: './cypress/fixtures/shared/cluster-observability-operator/update-mcp-image.sh',
      componentName: 'Monitoring Console Plugin',
    });
  },

  setupClusterHealthAnalyzer(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    imagePatchUtils.patchCOOCSVImage(CLUSTER_OBSERVABILITY_OPERATOR, {
      envVar: 'CHA_IMAGE',
      scriptPath: './cypress/fixtures/shared/cluster-observability-operator/update-cha-image.sh',
      componentName: 'cluster-health-analyzer',
    });
  },

  /**
   * After the monitoring-console-plugin pod is running, verify it uses the
   * expected CI image. If OLM reverted the CSV patch, re-apply it, patch the
   * deployment directly, and wait until the pod rolls out with the correct image.
   */
  verifyMonitoringConsolePluginImage(MCP: { namespace: string }): void {
    const expectedImage = Cypress.env('MCP_CONSOLE_IMAGE');
    if (!expectedImage) {
      return;
    }

    cy.log('Verify monitoring-console-plugin pod image matches expected CI image');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    const maxAttempts = 5;
    const ns = MCP.namespace;

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(ns)) {
      throw new Error(`Invalid Kubernetes namespace: ${ns}`);
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(expectedImage)) {
      throw new Error(`Invalid container image reference: ${expectedImage}`);
    }

    const execEnv = { KUBECONFIG: kubeconfig, NS: ns };

    const checkAndFix = (attempt: number): void => {
      cy.exec(
        'oc get pods -l app.kubernetes.io/instance=monitoring -n "$NS" ' +
          "-o jsonpath='{.items[0].spec.containers[0].image}'",
        { failOnNonZeroExit: false, env: execEnv },
      ).then((result) => {
        const currentImage = result.stdout.replace(/'/g, '').trim();
        cy.log(
          `monitoring-console-plugin image check ` +
            `(attempt ${attempt}/${maxAttempts}): ${currentImage}`,
        );

        if (currentImage === expectedImage) {
          cy.log('monitoring-console-plugin pod image verified successfully');
          return;
        }

        if (attempt >= maxAttempts) {
          throw new Error(
            `monitoring-console-plugin pod image mismatch after ${maxAttempts} attempts.\n` +
              `Expected: ${expectedImage}\nActual: ${currentImage}`,
          );
        }

        cy.log('Image mismatch detected. Re-patching CSV and deployment...');

        cy.exec('./cypress/fixtures/coo/update-mcp-image.sh', {
          env: {
            MCP_CONSOLE_IMAGE: expectedImage,
            KUBECONFIG: kubeconfig,
            MCP_NAMESPACE: ns,
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: false,
        });

        cy.exec(
          'oc get deployment -l app.kubernetes.io/instance=monitoring -n "$NS" ' +
            "-o jsonpath='{.items[0].metadata.name}'",
          { failOnNonZeroExit: false, env: execEnv },
        ).then((deployResult) => {
          const deployName = deployResult.stdout.replace(/'/g, '').trim();
          if (deployName && /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(deployName)) {
            cy.log(`Patching deployment/${deployName} image directly`);
            cy.exec(
              'oc patch deployment "$DEPLOY_NAME" -n "$NS" --type=json ' +
                '-p "[{\\"op\\":\\"replace\\",\\"path\\":\\"/spec/template/spec/containers/0/image\\",' +
                '\\"value\\":\\"$EXPECTED_IMAGE\\"}]"',
              {
                env: {
                  ...execEnv,
                  DEPLOY_NAME: deployName,
                  EXPECTED_IMAGE: expectedImage,
                },
              },
            );
            cy.exec('oc rollout status deployment/"$DEPLOY_NAME" -n "$NS" --timeout=120s', {
              timeout: 130000,
              env: { ...execEnv, DEPLOY_NAME: deployName },
            });
          }
        });

        waitForPodsReady('app.kubernetes.io/instance=monitoring', ns, readyTimeoutMilliseconds);

        checkAndFix(attempt + 1);
      });
    };

    checkAndFix(1);
  },

  /**
   * After the monitoring-console-plugin pod is running, verify it uses the
   * expected CI image. If OLM reverted the CSV patch, re-apply it, patch the
   * deployment directly, and wait until the pod rolls out with the correct image.
   */
  verifyMonitoringConsolePluginImage(MCP: { namespace: string }): void {
    const expectedImage = Cypress.env('MCP_CONSOLE_IMAGE');
    if (!expectedImage) {
      return;
    }

    cy.log('Verify monitoring-console-plugin pod image matches expected CI image');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    const maxAttempts = 5;
    const ns = MCP.namespace;

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(ns)) {
      throw new Error(`Invalid Kubernetes namespace: ${ns}`);
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(expectedImage)) {
      throw new Error(`Invalid container image reference: ${expectedImage}`);
    }

    const execEnv = { KUBECONFIG: kubeconfig, NS: ns };

    const checkAndFix = (attempt: number): void => {
      cy.exec(
        'oc get pods -l app.kubernetes.io/instance=monitoring -n "$NS" ' +
          "-o jsonpath='{.items[0].spec.containers[0].image}'",
        { failOnNonZeroExit: false, env: execEnv },
      ).then((result) => {
        const currentImage = result.stdout.replace(/'/g, '').trim();
        cy.log(
          `monitoring-console-plugin image check ` +
            `(attempt ${attempt}/${maxAttempts}): ${currentImage}`,
        );

        if (currentImage === expectedImage) {
          cy.log('monitoring-console-plugin pod image verified successfully');
          return;
        }

        if (attempt >= maxAttempts) {
          throw new Error(
            `monitoring-console-plugin pod image mismatch after ${maxAttempts} attempts.\n` +
              `Expected: ${expectedImage}\nActual: ${currentImage}`,
          );
        }

        cy.log('Image mismatch detected. Re-patching CSV and deployment...');

        cy.exec('./cypress/fixtures/coo/update-mcp-image.sh', {
          env: {
            MCP_CONSOLE_IMAGE: expectedImage,
            KUBECONFIG: kubeconfig,
            MCP_NAMESPACE: ns,
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: false,
        });

        cy.exec(
          'oc get deployment -l app.kubernetes.io/instance=monitoring -n "$NS" ' +
            "-o jsonpath='{.items[0].metadata.name}'",
          { failOnNonZeroExit: false, env: execEnv },
        ).then((deployResult) => {
          const deployName = deployResult.stdout.replace(/'/g, '').trim();
          if (deployName && /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(deployName)) {
            cy.log(`Patching deployment/${deployName} image directly`);
            cy.exec(
              'oc patch deployment "$DEPLOY_NAME" -n "$NS" --type=json ' +
                '-p "[{\\"op\\":\\"replace\\",\\"path\\":\\"/spec/template/spec/containers/0/image\\",' +
                '\\"value\\":\\"$EXPECTED_IMAGE\\"}]"',
              {
                env: {
                  ...execEnv,
                  DEPLOY_NAME: deployName,
                  EXPECTED_IMAGE: expectedImage,
                },
              },
            );
            cy.exec('oc rollout status deployment/"$DEPLOY_NAME" -n "$NS" --timeout=120s', {
              timeout: 130000,
              env: { ...execEnv, DEPLOY_NAME: deployName },
            });
          }
        });

        waitForPodsReady('app.kubernetes.io/instance=monitoring', ns, readyTimeoutMilliseconds);

        checkAndFix(attempt + 1);
      });
    };

    checkAndFix(1);
  },

  revertMonitoringPluginImage(CLUSTER_MONITORING_OPERATOR: { namespace: string }): void {
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. Lets revert CMO operator CSV');
      cy.exec('./cypress/fixtures/shared/cluster-monitoring-operator/reenable-monitoring.sh', {
        env: {
          MP_IMAGE: Cypress.env('MP_IMAGE'),
          KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
          MP_NAMESPACE: `${CLUSTER_MONITORING_OPERATOR.namespace}`,
        },
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true,
      }).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO CSV reverted successfully with Monitoring Plugin image: ${result.stdout}`);

        waitForPodsReadyOrAbsent(
          'app.kubernetes.io/name=monitoring-plugin',
          CLUSTER_MONITORING_OPERATOR.namespace,
          readyTimeoutMilliseconds,
        );
        cy.log(
          `Monitoring plugin pods verified in namespace: ${CLUSTER_MONITORING_OPERATOR.namespace}`,
        );

        cy.reload(true);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping reverting the image in CMO operator CSV.');
    }
  },
};
