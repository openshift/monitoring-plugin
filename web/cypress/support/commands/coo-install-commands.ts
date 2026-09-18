import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';
import { installTimeoutMilliseconds, readyTimeoutMilliseconds } from '../timeouts';
import { CLUSTER_OBSERVABILITY_OPERATOR } from '../operators';

export {};

type COOInstallationCSV = {
  metadata: { name: string };
  status?: { phase?: string };
  spec: {
    install: {
      spec: {
        deployments: Array<{
          name: string;
          spec: {
            template: { spec: { containers: Array<{ name: string; args?: string[] }> } };
          };
        }>;
      };
    };
  };
};

function waitForCOOSubscriptionDeletion(): void {
  cy.waitUntil(
    () =>
      cy
        .adminCLI(
          `oc get subscription ${CLUSTER_OBSERVABILITY_OPERATOR.packageName} -n ` +
            `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
          { failOnNonZeroExit: false },
        )
        .then((result) => result.code !== 0),
    {
      timeout: readyTimeoutMilliseconds,
      interval: 5000,
      errorMsg: `Subscription ${CLUSTER_OBSERVABILITY_OPERATOR.packageName} was not deleted.`,
    },
  );
}

export const cooInstallUtils = {
  ensureCOOInstalled(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Using the pre-provisioned Cluster Observability Operator.');
      return;
    }

    let installationIdentity: string;
    if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')) {
      installationIdentity = `bundle:${Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')}`;
    } else if (Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      installationIdentity = `bundle:${Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')}`;
    } else if (Cypress.env('FBC_STAGE_COO_IMAGE')) {
      installationIdentity = `fbc:${Cypress.env('FBC_STAGE_COO_IMAGE')}`;
    } else if (Cypress.env('COO_UI_INSTALL')) {
      installationIdentity = 'catalog:redhat-operators';
    } else {
      throw new Error(
        'No CYPRESS env set for operator installation, check the README for more details.',
      );
    }

    cy.adminCLI(`oc get namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} -o json`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      let installedIdentity = '';
      if (result.code === 0) {
        installedIdentity =
          JSON.parse(result.stdout).metadata.annotations?.[
            'e2e.monitoring.openshift.io/coo-installation'
          ] ?? '';
      }
      if (installedIdentity === installationIdentity) {
        cy.adminCLI(
          `oc get deployment observability-operator -n ` +
            `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
            `-o jsonpath='{.status.availableReplicas}'`,
          { failOnNonZeroExit: false },
        ).then((deploymentResult) => {
          if (deploymentResult.code === 0 && Number(deploymentResult.stdout) > 0) {
            cy.log(`Cluster Observability Operator installation matches ${installationIdentity}`);
            return;
          }

          cy.log('Cluster Observability Operator is unhealthy; reinstalling');
          cooInstallUtils.cleanupCOONamespace();
          cooInstallUtils.installCOO();
          cy.adminCLI(
            `oc annotate namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
              `e2e.monitoring.openshift.io/coo-installation="${installationIdentity}" ` +
              `--overwrite`,
          );
        });
        return;
      }

      if (result.code === 0) {
        cy.log(
          `Cluster Observability Operator installation changed from ${
            installedIdentity || 'unknown'
          } to ${installationIdentity}; reinstalling`,
        );
        cooInstallUtils.cleanupCOONamespace();
      } else {
        cy.log('Cluster Observability Operator is not installed; installing');
      }

      cooInstallUtils.installCOO();
      cy.adminCLI(
        `oc annotate namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
          `e2e.monitoring.openshift.io/coo-installation="${installationIdentity}" ` +
          `--overwrite`,
      );
    });
  },

  installCOO(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Cluster Observability Operator installation.');
    } else if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. COO will be installed from redhat-operators catalog source');
      cy.log('Install Cluster Observability Operator');
      operatorHubPage.installOperator(
        CLUSTER_OBSERVABILITY_OPERATOR.packageName,
        'redhat-operators',
      );
      cy.get('.co-clusterserviceversion-install__heading', {
        timeout: installTimeoutMilliseconds,
      }).should('include.text', 'Operator installed successfully');
      cy.adminCLI(
        `oc label namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true`,
      );
    } else if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')) {
      cy.log(
        'KONFLUX_COO_BUNDLE_IMAGE is set. COO operator will be installed from Konflux bundle.',
      );
      cy.log('Install Cluster Observability Operator');
      cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`);
      cy.exec(
        `oc create namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --kubeconfig ` +
          `"${Cypress.env(
            'KUBECONFIG_PATH',
          )}" --dry-run=client -o yaml | oc apply --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" -f -`,
      );
      cy.adminCLI(
        `oc label namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true`,
      );
      cy.adminCLI(
        `operator-sdk run bundle --timeout=10m --install-mode=AllNamespaces --namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } --security-context-config restricted ${Cypress.env(
          'KONFLUX_COO_BUNDLE_IMAGE',
        )} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      cy.log(
        'CUSTOM_COO_BUNDLE_IMAGE is set. COO operator will be installed from custom built bundle.',
      );
      cy.log('Install Cluster Observability Operator');
      cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`);
      cy.log(`Creating namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);
      cy.exec(
        `oc create namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --kubeconfig ` +
          `"${Cypress.env(
            'KUBECONFIG_PATH',
          )}" --dry-run=client -o yaml | oc apply --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" -f -`,
      );
      cy.log(
        `Labeling namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} with ` +
          `openshift.io/cluster-monitoring=true`,
      );
      cy.adminCLI(
        `oc label namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true`,
      );
      cy.adminCLI(
        `operator-sdk run bundle --timeout=10m --install-mode=AllNamespaces --namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } --security-context-config restricted ${Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')} --verbose`,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('FBC_STAGE_COO_IMAGE')) {
      cy.log('FBC_COO_IMAGE is set. COO operator will be installed from FBC image.');
      cy.log('Install Cluster Observability Operator');
      cy.adminCLI(`oc  apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`);
      cy.exec('./cypress/fixtures/coo/coo_stage.sh', {
        env: {
          FBC_STAGE_COO_IMAGE: Cypress.env('FBC_STAGE_COO_IMAGE'),
          KUBECONFIG: Cypress.env('KUBECONFIG_PATH') as string,
        },
        timeout: installTimeoutMilliseconds,
      });
    } else {
      throw new Error(
        'No CYPRESS env set for operator installation, check the README for more details.',
      );
    }
  },

  waitForCOOReady(): void {
    cy.log('Check Cluster Observability Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.adminCLI(`oc project ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} -o name --kubeconfig ` +
              `${kubeconfig} | grep observability-operator | grep -v bundle`,
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg:
          `Observability operator pod not found in namespace ` +
          `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} -o name --kubeconfig ` +
        `${kubeconfig} | grep observability-operator | grep -v bundle`,
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim();
        cy.log(`Found COO pod: ${podName}`);

        cy.adminCLI(
          `oc wait --for=condition=Ready ${podName} -n ` +
            `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --timeout=120s`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(
            `Observability-operator pod is now running in namespace: ` +
              `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
          );
        });
      });

    if (Cypress.env('COO_UI_INSTALL')) {
      cy.dynamicPluginWorkConsoleAround();

      cy.switchPerspective('Core platform');
      cy.get('#page-sidebar').then(($sidebar) => {
        const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
        nav.sidenav.clickNavLink([section, 'Installed Operators']);
      });

      cy.byTestID('name-filter-input').should('be.visible').type('Observability{enter}');
      cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds })
        .eq(0)
        .should('contain.text', 'Succeeded');
    }
  },

  enableOpenShiftMode(): void {
    if (!Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') && !Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    const ns = CLUSTER_OBSERVABILITY_OPERATOR.namespace;
    cy.log('Enabling OpenShift mode on bundle-installed COO');

    const flag = '--openshift.enabled=true';
    const reconcile = (attempt: number): void => {
      cy.adminCLI(`oc get csv -n ${ns} -o json`).then((csvResult) => {
        const csvs = JSON.parse(csvResult.stdout).items as COOInstallationCSV[];
        const csv = csvs.filter(
          (item) =>
            item.metadata.name.includes('cluster-observability-operator') &&
            item.status?.phase === 'Succeeded',
        );
        if (csv.length !== 1) {
          throw new Error(`Expected one succeeded COO CSV in ${ns}, found ${csv.length}.`);
        }

        const deploymentIndex = csv[0].spec.install.spec.deployments.findIndex(
          (deployment) => deployment.name === 'observability-operator',
        );
        const containerIndex = csv[0].spec.install.spec.deployments[
          deploymentIndex
        ]?.spec.template.spec.containers.findIndex((container) => container.name === 'operator');
        if (deploymentIndex === -1 || containerIndex === undefined || containerIndex === -1) {
          throw new Error('The COO CSV does not define the observability-operator container.');
        }

        const csvArgs =
          csv[0].spec.install.spec.deployments[deploymentIndex].spec.template.spec.containers[
            containerIndex
          ].args ?? [];
        cy.adminCLI(`oc get deployment observability-operator -n ${ns} -o json`).then(
          (deploymentResult) => {
            const deploymentArgs = JSON.parse(deploymentResult.stdout).spec.template.spec
              .containers[0].args as string[] | undefined;
            if (csvArgs.includes(flag) && deploymentArgs?.includes(flag)) {
              cy.log('OpenShift mode is enabled on the COO CSV and deployment.');
              return;
            }
            if (attempt === 5) {
              throw new Error('OpenShift mode did not converge after 5 attempts.');
            }

            const csvArgsPath =
              `/spec/install/spec/deployments/${deploymentIndex}/spec/template/spec/containers/` +
              `${containerIndex}/args`;
            const deploymentArgsPath = '/spec/template/spec/containers/0/args';
            cy.exec(
              'oc patch csv "$CSV_NAME" -n "$NAMESPACE" --type=json -p "$PATCH" --kubeconfig "$KUBECONFIG"',
              {
                env: {
                  CSV_NAME: csv[0].metadata.name,
                  NAMESPACE: ns,
                  KUBECONFIG: kubeconfig,
                  PATCH: JSON.stringify([
                    csvArgs.length
                      ? { op: 'add', path: `${csvArgsPath}/-`, value: flag }
                      : { op: 'add', path: csvArgsPath, value: [flag] },
                  ]),
                },
              },
            );
            cy.exec(
              'oc patch deployment observability-operator -n "$NAMESPACE" --type=json -p "$PATCH" --kubeconfig "$KUBECONFIG"',
              {
                env: {
                  NAMESPACE: ns,
                  KUBECONFIG: kubeconfig,
                  PATCH: JSON.stringify([
                    deploymentArgs?.length
                      ? { op: 'add', path: `${deploymentArgsPath}/-`, value: flag }
                      : { op: 'add', path: deploymentArgsPath, value: [flag] },
                  ]),
                },
              },
            );
            cy.adminCLI(
              `oc rollout status deployment/observability-operator -n ${ns} ` + `--timeout=120s`,
              { timeout: 130000 },
            );
            reconcile(attempt + 1);
          },
        );
      });
    };

    reconcile(1);
  },

  cleanupCOONamespace(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      return;
    }

    cy.log('Remove Cluster Observability Operator namespace');

    cy.adminCLI(`oc get namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`, {
      timeout: readyTimeoutMilliseconds,
      failOnNonZeroExit: false,
    }).then((checkResult) => {
      if (checkResult.code === 0) {
        cy.log('Namespace exists, proceeding with deletion');

        if (Cypress.env('COO_UI_INSTALL')) {
          operatorHubPage.uninstallOperator(CLUSTER_OBSERVABILITY_OPERATOR.operatorName);
          waitForCOOSubscriptionDeletion();
        } else {
          cy.log('Delete Cluster Observability Operator subscription');
          cy.executeAndDelete(
            `oc delete subscription ${CLUSTER_OBSERVABILITY_OPERATOR.packageName} -n ` +
              `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --ignore-not-found --wait=true ` +
              `--kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          );
          waitForCOOSubscriptionDeletion();

          cy.log('Delete Cluster Observability Operator CSV');
          cy.adminCLI(
            `oc delete csv -n ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
              `-l operators.coreos.com/${CLUSTER_OBSERVABILITY_OPERATOR.packageName}.` +
              `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --ignore-not-found --wait=false`,
            { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: false },
          );

          cy.log('Delete Cluster Observability Operator resource');
          cy.adminCLI(
            `oc delete operator ${CLUSTER_OBSERVABILITY_OPERATOR.packageName}.` +
              `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --ignore-not-found`,
            { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: false },
          );

          cy.log('Delete Cluster Observability OperatorGroup');
          cy.adminCLI(
            `oc delete operatorgroup --all -n ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} ` +
              `--ignore-not-found --wait=false`,
            { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: false },
          );
        }

        if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') || Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
          cy.adminCLI(
            `operator-sdk cleanup observability-operator -n ` +
              `${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
            { failOnNonZeroExit: false, timeout: 60000 },
          );
        }

        cy.adminCLI(
          `oc delete namespace ${
            CLUSTER_OBSERVABILITY_OPERATOR.namespace
          } --ignore-not-found --wait=false`,
          { timeout: 30000, failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code === 0) {
            cy.log(`Namespace deletion initiated for ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);
          } else {
            cy.log(`Failed to initiate deletion: ${result.stderr}`);
          }
        });

        cy.waitUntil<boolean>(
          () =>
            cy
              .adminCLI(`oc get namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`, {
                failOnNonZeroExit: false,
              })
              .then((result) => {
                if (result.code !== 0) {
                  Cypress.log({
                    name: 'cleanupCOONamespace',
                    message: `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} is successfully deleted.`,
                  });
                  return cy.wrap(true, { log: false });
                }

                return cy
                  .exec(
                    `./cypress/fixtures/coo/force_delete_ns.sh ${
                      CLUSTER_OBSERVABILITY_OPERATOR.namespace
                    } "${Cypress.env('KUBECONFIG_PATH')}"`,
                    { failOnNonZeroExit: false, timeout: installTimeoutMilliseconds },
                  )
                  .then((forceResult) => {
                    Cypress.log({
                      name: 'cleanupCOONamespace',
                      message: `Force delete output: ${forceResult.stdout}`,
                    });
                    return false;
                  });
              }),
          {
            timeout: 600000,
            interval: 15000,
            errorMsg: `Timed out deleting namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
          },
        );
      } else {
        cy.log('Namespace does not exist, skipping deletion');
      }
    });
  },
};
