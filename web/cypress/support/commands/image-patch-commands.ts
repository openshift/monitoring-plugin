import { waitForPodsReady, waitForPodsReadyOrAbsent } from './wait-utils';
import { readyTimeoutMilliseconds } from '../timeouts';
import { CLUSTER_MONITORING_OPERATOR, CLUSTER_OBSERVABILITY_OPERATOR } from '../operators';

export {};

type COOOperatorContainer = {
  name: string;
  args?: string[];
  env?: Array<{ name: string; value?: string }>;
};

type COOCSV = {
  metadata: { name: string };
  status?: { phase?: string };
  spec: {
    relatedImages?: Array<{ name: string; image: string }>;
    install: {
      spec: {
        deployments: Array<{
          name: string;
          spec: { template: { spec: { containers: COOOperatorContainer[] } } };
        }>;
      };
    };
  };
};

function getImage(resource: string, namespace: string): Cypress.Chainable<string> {
  return cy
    .adminCLI(
      `oc get ${resource} -n ${namespace} ` +
        `-o jsonpath='{.spec.template.spec.containers[0].image}'`,
    )
    .then((result) => result.stdout.trim());
}

function waitForMonitoringPluginImage(namespace: string, expectedImage: string): void {
  cy.waitUntil(
    () =>
      cy
        .adminCLI(
          `oc get pods -l app.kubernetes.io/name=monitoring-plugin -n ${namespace} ` +
            `-o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\\n"}{end}'`,
          { failOnNonZeroExit: false },
        )
        .then((result) => {
          const images = result.stdout.trim().split('\n').filter(Boolean);
          return (
            result.code === 0 &&
            images.length > 0 &&
            images.every((image) => image === expectedImage)
          );
        }),
    {
      timeout: readyTimeoutMilliseconds,
      interval: 5000,
      errorMsg: `Monitoring Plugin pods did not converge to image ${expectedImage}`,
    },
  );
}

function verifyOperandImage(namespace: string, selector: string, expectedImage: string): void {
  waitForPodsReady(selector, namespace, readyTimeoutMilliseconds);
  cy.adminCLI(
    `oc get pods -l ${selector} -n ${namespace} ` +
      `-o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\\n"}{end}'`,
  ).then((result) => {
    const images = result.stdout.trim().split('\n').filter(Boolean);
    expect(images.length).to.be.greaterThan(0);
    expect(images.every((image) => image === expectedImage)).to.equal(true);
  });
}

export const imagePatchUtils = {
  getImage,

  setupMonitoringPluginImage(): void {
    const expectedImage = Cypress.env('MP_IMAGE') as string | undefined;
    if (expectedImage) {
      cy.log('Check Monitoring Plugin image');
      imagePatchUtils
        .getImage('deployment/monitoring-plugin', CLUSTER_MONITORING_OPERATOR.namespace)
        .then((currentImage) => {
          if (currentImage === expectedImage) {
            waitForPodsReady(
              'app.kubernetes.io/name=monitoring-plugin',
              CLUSTER_MONITORING_OPERATOR.namespace,
              readyTimeoutMilliseconds,
            );
            waitForMonitoringPluginImage(CLUSTER_MONITORING_OPERATOR.namespace, expectedImage);
            cy.log(`Monitoring Plugin already uses ${expectedImage}`);
            return;
          }

          cy.log(
            `Update Monitoring Plugin image from ${currentImage || 'unknown'} to ${expectedImage}`,
          );
          cy.exec('./cypress/fixtures/cmo/update-monitoring-plugin-image.sh', {
            env: {
              MP_IMAGE: expectedImage,
              KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
              MP_NAMESPACE: CLUSTER_MONITORING_OPERATOR.namespace,
            },
            timeout: readyTimeoutMilliseconds,
          }).then((result) => {
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
          waitForMonitoringPluginImage(CLUSTER_MONITORING_OPERATOR.namespace, expectedImage);
          cy.reload(true);
        });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }
  },

  reconcileCOOCSVImage(config: {
    envVar: string;
    componentName: string;
    relatedImageNames: string[];
    operatorEnvNames: string[];
  }): void {
    const expectedImage = Cypress.env(config.envVar) as string | undefined;
    if (!expectedImage) {
      cy.log(`${config.envVar} is not set. Skipping ${config.componentName} image reconciliation.`);
      return;
    }

    const namespace = CLUSTER_OBSERVABILITY_OPERATOR.namespace;
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    const reconcile = (attempt: number): void => {
      cy.adminCLI(`oc get csv -n ${namespace} -o json`).then((result) => {
        const csvs = JSON.parse(result.stdout).items as COOCSV[];
        const csv = csvs.filter((item) =>
          item.metadata.name.includes('cluster-observability-operator'),
        );
        if (csv.length !== 1) {
          throw new Error(
            `Expected one Cluster Observability Operator CSV in ${namespace}, found ${csv.length}.`,
          );
        }

        const relatedImages = csv[0].spec.relatedImages ?? [];
        const deploymentIndex = csv[0].spec.install.spec.deployments.findIndex(
          (deployment) => deployment.name === 'observability-operator',
        );
        const containerIndex = csv[0].spec.install.spec.deployments[
          deploymentIndex
        ]?.spec.template.spec.containers.findIndex((container) => container.name === 'operator');
        if (deploymentIndex === -1 || containerIndex === undefined || containerIndex === -1) {
          throw new Error('The COO CSV does not define the observability-operator container.');
        }

        const env =
          csv[0].spec.install.spec.deployments[deploymentIndex].spec.template.spec.containers[
            containerIndex
          ].env ?? [];
        const patch = [
          ...config.relatedImageNames.map((name) => {
            const index = relatedImages.findIndex((image) => image.name === name);
            if (index === -1) {
              throw new Error(`The COO CSV does not define related image ${name}.`);
            }
            return {
              op: 'replace',
              path: `/spec/relatedImages/${index}/image`,
              value: expectedImage,
            };
          }),
          ...config.operatorEnvNames.map((name) => {
            const index = env.findIndex((entry) => entry.name === name);
            if (index === -1) {
              throw new Error(`The COO CSV does not define operator environment variable ${name}.`);
            }
            return {
              op: 'replace',
              path:
                `/spec/install/spec/deployments/${deploymentIndex}/spec/template/spec/containers/` +
                `${containerIndex}/env/${index}/value`,
              value: expectedImage,
            };
          }),
        ];
        const currentImages = [
          ...config.relatedImageNames.map(
            (name) => relatedImages.find((image) => image.name === name)?.image,
          ),
          ...config.operatorEnvNames.map((name) => env.find((entry) => entry.name === name)?.value),
        ];
        if (currentImages.every((image) => image === expectedImage)) {
          cy.log(`${config.componentName} image already matches ${expectedImage}`);
          return;
        }

        if (attempt === 5) {
          throw new Error(
            `${config.componentName} image did not converge to ${expectedImage} after 5 attempts.`,
          );
        }

        cy.exec(
          'oc patch csv "$CSV_NAME" -n "$NAMESPACE" --type=json -p "$PATCH" --kubeconfig "$KUBECONFIG"',
          {
            env: {
              CSV_NAME: csv[0].metadata.name,
              NAMESPACE: namespace,
              PATCH: JSON.stringify(patch),
              KUBECONFIG: kubeconfig,
            },
          },
        );
        cy.adminCLI(
          `oc rollout status deployment/observability-operator -n ${namespace} --timeout=120s`,
          { timeout: 130000 },
        );
        reconcile(attempt + 1);
      });
    };

    reconcile(1);
  },

  setupMonitoringConsolePlugin(): void {
    imagePatchUtils.reconcileCOOCSVImage({
      envVar: 'MCP_CONSOLE_IMAGE',
      componentName: 'Monitoring Console Plugin',
      relatedImageNames: ['ui-monitoring', 'ui-monitoring-pf5', 'ui-monitoring-pf6'],
      operatorEnvNames: [
        'RELATED_IMAGE_CONSOLE_MONITORING_PLUGIN',
        'RELATED_IMAGE_CONSOLE_MONITORING_PLUGIN_PF5',
        'RELATED_IMAGE_CONSOLE_MONITORING_PLUGIN_PF6',
      ],
    });
  },

  setupClusterHealthAnalyzer(): void {
    imagePatchUtils.reconcileCOOCSVImage({
      envVar: 'CHA_IMAGE',
      componentName: 'cluster-health-analyzer',
      relatedImageNames: ['cluster-health-analyzer'],
      operatorEnvNames: ['RELATED_IMAGE_CLUSTER_HEALTH_ANALYZER'],
    });
  },

  verifyMonitoringConsolePluginImage(): void {
    const expectedImage = Cypress.env('MCP_CONSOLE_IMAGE') as string | undefined;
    if (!expectedImage) {
      return;
    }

    verifyOperandImage(
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      'app.kubernetes.io/instance=monitoring',
      expectedImage,
    );
  },

  verifyClusterHealthAnalyzerImage(): void {
    const expectedImage = Cypress.env('CHA_IMAGE') as string | undefined;
    if (!expectedImage) {
      return;
    }

    verifyOperandImage(
      CLUSTER_OBSERVABILITY_OPERATOR.namespace,
      'app.kubernetes.io/instance=health-analyzer',
      expectedImage,
    );
  },

  revertMonitoringPluginImage(): void {
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. Lets revert CMO operator CSV');
      cy.exec('./cypress/fixtures/cmo/reenable-monitoring.sh', {
        env: {
          MP_IMAGE: Cypress.env('MP_IMAGE'),
          KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
          MP_NAMESPACE: CLUSTER_MONITORING_OPERATOR.namespace,
        },
        timeout: readyTimeoutMilliseconds,
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
