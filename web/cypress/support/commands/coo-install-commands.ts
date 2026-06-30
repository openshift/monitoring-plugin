import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';

export {};

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

export const cooInstallUtils = {
  installCOO(MCP: { namespace: string; packageName: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Cluster Observability Operator installation.');
    } else if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. COO will be installed from redhat-operators catalog source');
      cy.log('Install Cluster Observability Operator');
      operatorHubPage.installOperator(MCP.packageName, 'redhat-operators');
      cy.get('.co-clusterserviceversion-install__heading', {
        timeout: installTimeoutMilliseconds,
      }).should('include.text', 'Operator installed successfully');
      cy.exec(
        `oc label namespace ${
          MCP.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}"`,
      );
    } else if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')) {
      cy.log(
        'KONFLUX_COO_BUNDLE_IMAGE is set. COO operator will be installed from Konflux bundle.',
      );
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}" apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        `oc create namespace ${MCP.namespace} --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}" --dry-run=client -o yaml | oc apply --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" -f -`,
      );
      cy.exec(
        `oc label namespace ${
          MCP.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}"`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --install-mode=AllNamespaces --namespace ${
          MCP.namespace
        } --security-context-config restricted ${Cypress.env(
          'KONFLUX_COO_BUNDLE_IMAGE',
        )} --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      cy.log(
        'CUSTOM_COO_BUNDLE_IMAGE is set. COO operator will be installed from custom built bundle.',
      );
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}" apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.log(`Creating namespace ${MCP.namespace}`);
      cy.exec(
        `oc create namespace ${MCP.namespace} --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}" --dry-run=client -o yaml | oc apply --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" -f -`,
      );
      cy.log(`Labeling namespace ${MCP.namespace} with openshift.io/cluster-monitoring=true`);
      cy.exec(
        `oc label namespace ${
          MCP.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}"`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --install-mode=AllNamespaces --namespace ${
          MCP.namespace
        } --security-context-config restricted ${Cypress.env(
          'CUSTOM_COO_BUNDLE_IMAGE',
        )} --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('FBC_STAGE_COO_IMAGE')) {
      cy.log('FBC_COO_IMAGE is set. COO operator will be installed from FBC image.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}" apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
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

  waitForCOOReady(MCP: { namespace: string }): void {
    cy.log('Check Cluster Observability Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.exec(`oc project ${MCP.namespace} --kubeconfig ${kubeconfig}`);

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${MCP.namespace} -o name --kubeconfig ${kubeconfig} ` +
              '| grep observability-operator | grep -v bundle',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `Observability operator pod not found in namespace ${MCP.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${MCP.namespace} -o name --kubeconfig ${kubeconfig} ` +
        '| grep observability-operator | grep -v bundle',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim();
        cy.log(`Found COO pod: ${podName}`);

        cy.exec(
          `oc wait --for=condition=Ready ${podName} -n ${MCP.namespace} ` +
            `--timeout=120s --kubeconfig ${kubeconfig}`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Observability-operator pod is now running in namespace: ${MCP.namespace}`);
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

  enableOpenShiftMode(MCP: { namespace: string }): void {
    if (!Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') && !Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    const ns = MCP.namespace;
    cy.log('Enabling OpenShift mode on bundle-installed COO');

    // Patch the CSV so OLM's source of truth includes the flag.
    // Find the correct CSV and deployment index for observability-operator.
    cy.exec(
      `oc get csv -n ${ns} -o jsonpath=` +
        `'{range .items[?(@.status.phase=="Succeeded")]}` +
        `{.metadata.name}{"\\n"}{end}' --kubeconfig ${kubeconfig}`,
    ).then((result) => {
      const csvNames = result.stdout.trim().split('\n').filter(Boolean);
      const csvName = csvNames.find((name) => name.includes('observability-operator'));
      if (!csvName) {
        throw new Error(
          `No observability-operator CSV found in namespace ${ns}. ` +
            `Available CSVs: [${csvNames.join(', ')}]`,
        );
      }
      cy.log(`Found CSV: ${csvName}`);

      cy.exec(
        `oc get csv ${csvName} -n ${ns} -o jsonpath=` +
          `'{range .spec.install.spec.deployments[*]}` +
          `{.name}{"\\n"}{end}' --kubeconfig ${kubeconfig}`,
      ).then((deploymentsResult) => {
        const deploymentNames = deploymentsResult.stdout.trim().split('\n').filter(Boolean);
        const opIdx = deploymentNames.indexOf('observability-operator');
        if (opIdx === -1) {
          throw new Error(
            `observability-operator not found in CSV deployments: [${deploymentNames.join(', ')}]`,
          );
        }
        cy.log(`Patching CSV ${csvName} deployment[${opIdx}] to add --openshift.enabled=true`);
        cy.exec(
          `oc patch csv ${csvName} -n ${ns} --type=json ` +
            `-p '[{"op":"add","path":"/spec/install/spec/deployments/` +
            `${opIdx}/spec/template/spec/containers/0/args/-",` +
            `"value":"--openshift.enabled=true"}]' ` +
            `--kubeconfig ${kubeconfig}`,
        );
      });
    });

    // Step 2: Patch the deployment directly to apply the change immediately.
    cy.log('Patching deployment to add --openshift.enabled=true');
    cy.exec(
      `oc patch deployment observability-operator -n ${ns} --type=json ` +
        `-p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-",` +
        `"value":"--openshift.enabled=true"}]' ` +
        `--kubeconfig ${kubeconfig}`,
    );

    // Step 3: Wait for the rollout to complete.
    cy.exec(
      `oc rollout status deployment/observability-operator -n ${ns} ` +
        `--timeout=120s --kubeconfig ${kubeconfig}`,
      { timeout: 130000 },
    );

    // Final verification: confirm the running pod actually has the flag.
    cy.exec(
      `oc get deployment observability-operator -n ${ns} ` +
        `-o jsonpath="{.spec.template.spec.containers[0].args}" --kubeconfig ${kubeconfig}`,
    ).then((result) => {
      const args = result.stdout;
      cy.log(`Deployment args after rollout: ${args}`);
      if (!args.includes('openshift.enabled=true')) {
        cy.exec(`oc get csv -n ${ns} -o yaml --kubeconfig ${kubeconfig}`, {
          failOnNonZeroExit: false,
        }).then((csvResult) => {
          cy.log(`CSV YAML:\n${csvResult.stdout.substring(0, 3000)}`);
        });
        cy.exec(
          `oc get deployment observability-operator -n ${ns} -o yaml --kubeconfig ${kubeconfig}`,
        ).then((yamlResult) => {
          cy.log(`Deployment YAML:\n${yamlResult.stdout}`);
        });
        cy.then(() => {
          throw new Error(
            '--openshift.enabled=true NOT found in deployment args after rollout. ' +
              `Actual args: ${args}`,
          );
        });
      }
    });

    cy.exec(
      `oc logs -l app.kubernetes.io/name=observability-operator -n ${ns} ` +
        `--tail=5 --kubeconfig ${kubeconfig}`,
      { failOnNonZeroExit: false },
    ).then((result) => {
      cy.log(`Operator logs after restart:\n${result.stdout}`);
    });
  },

  cleanupCOONamespace(MCP: { namespace: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      return;
    }

    cy.log('Remove Cluster Observability Operator namespace');

    // For bundle installs, run operator-sdk cleanup first to remove
    // CatalogSource, registry pod, and other bundle-specific resources.
    // The bundle package name is "observability-operator" (not the MCP.packageName
    // which is "cluster-observability-operator" used for catalog installs).
    if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') || Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      cy.exec(
        `operator-sdk cleanup observability-operator -n ${MCP.namespace} ` +
          `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false, timeout: 60000 },
      ).then((result) => {
        if (result.code === 0) {
          cy.log('operator-sdk cleanup completed successfully');
        } else {
          cy.log(`operator-sdk cleanup failed (may not exist): ${result.stderr}`);
        }
      });
    }

    cy.exec(`oc get namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`, {
      timeout: readyTimeoutMilliseconds,
      failOnNonZeroExit: false,
    }).then((checkResult) => {
      if (checkResult.code === 0) {
        cy.log('Namespace exists, proceeding with deletion');

        cy.exec(
          `oc delete csv --all -n ${
            MCP.namespace
          } --ignore-not-found --wait=false --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          { timeout: 30000, failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code === 0) {
            cy.log(`CSV deletion initiated in ${MCP.namespace}`);
          } else {
            cy.log(`CSV deletion failed or not found: ${result.stderr}`);
          }
        });

        cy.exec(
          `oc delete subscription --all -n ${
            MCP.namespace
          } --ignore-not-found --wait=false --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          { timeout: 30000, failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code === 0) {
            cy.log(`Subscription deletion initiated in ${MCP.namespace}`);
          } else {
            cy.log(`Subscription deletion failed or not found: ${result.stderr}`);
          }
        });

        cy.exec(
          `oc delete namespace ${
            MCP.namespace
          } --ignore-not-found --wait=false --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          { timeout: 30000, failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code === 0) {
            cy.log(`Namespace deletion initiated for ${MCP.namespace}`);
          } else {
            cy.log(`Failed to initiate deletion: ${result.stderr}`);
          }
        });

        const checkIntervalMs = 15000;
        const startTime = Date.now();
        const maxWaitTimeMs = 600000;

        const checkStatus = () => {
          const elapsed = Date.now() - startTime;

          if (elapsed > maxWaitTimeMs) {
            cy.log(
              `${elapsed}ms - Timeout reached (${maxWaitTimeMs / 60000}m). Namespace ${
                MCP.namespace
              } still terminating. Attempting force-delete.`,
            );
            return cy
              .exec(
                `./cypress/fixtures/coo/force_delete_ns.sh ${MCP.namespace} "${Cypress.env(
                  'KUBECONFIG_PATH',
                )}"`,
                { failOnNonZeroExit: false, timeout: installTimeoutMilliseconds },
              )
              .then((result) => {
                cy.log(`${elapsed}ms - Force delete output: ${result.stdout}`);
                if (result.code !== 0) {
                  cy.log(`Force delete failed with exit code ${result.code}: ${result.stderr}`);
                }
              });
          }

          cy.exec(
            `oc get ns ${MCP.namespace} --kubeconfig "${Cypress.env(
              'KUBECONFIG_PATH',
            )}" -o jsonpath='{.status.phase}'`,
            { failOnNonZeroExit: false },
          ).then((result) => {
            if (result.code !== 0) {
              cy.log(`${elapsed}ms - ${MCP.namespace} is successfully deleted.`);
              return;
            }
            const status = result.stdout.trim();

            if (status === 'Terminating') {
              cy.log(
                `${elapsed}ms - ${MCP.namespace} is still 'Terminating'. Retrying in ${
                  checkIntervalMs / 1000
                }s. Elapsed: ${Math.round(elapsed / 1000)}s`,
              );
              cy.exec(
                `./cypress/fixtures/coo/force_delete_ns.sh ${MCP.namespace} "${Cypress.env(
                  'KUBECONFIG_PATH',
                )}"`,
                { failOnNonZeroExit: false, timeout: installTimeoutMilliseconds },
              ).then((forceResult) => {
                cy.log(`${elapsed}ms - Force delete output: ${forceResult.stdout}`);
                if (forceResult.code !== 0) {
                  cy.log(
                    `Force delete failed with exit code ${forceResult.code}: ${forceResult.stderr}`,
                  );
                }
              });
              cy.wait(checkIntervalMs).then(checkStatus);
            } else {
              cy.log(
                `${elapsed}ms - ${MCP.namespace} changed to unexpected state: ${status}. ` +
                  'Stopping monitoring.',
              );
            }
          });
        };

        checkStatus();

        cy.then(() => {
          cooInstallUtils.waitForPodsDeleted(MCP.namespace, 300000);
        });
      } else {
        cy.log('Namespace does not exist, skipping deletion');
      }
    });
  },

  waitForPodsDeleted(namespace: string, maxWaitMs: number = 120000): void {
    const kubeconfigPath = Cypress.env('KUBECONFIG_PATH') as string;
    const checkIntervalMs = 5000;
    const startTime = Date.now();
    const podPatterns = 'monitoring|perses|perses-0|health-analyzer|troubleshooting-panel|korrel8r';

    const checkPods = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed > maxWaitMs) {
        throw new Error(`Timeout: Pods still exist after ${maxWaitMs / 1000}s`);
      }

      cy.exec(`oc get pods -n ${namespace} --kubeconfig ${kubeconfigPath} -o name`, {
        failOnNonZeroExit: false,
      }).then((result) => {
        if (result.code !== 0) {
          if (result.stderr.includes('not found')) {
            cy.log(`All target pods deleted after ${elapsed}ms (namespace gone)`);
          } else {
            cy.log(`${elapsed}ms - oc get pods failed: ${result.stderr}, retrying...`);
            cy.wait(checkIntervalMs).then(checkPods);
          }
          return;
        }

        const matchingPods = result.stdout
          .split('\n')
          .filter((line) => new RegExp(podPatterns).test(line));

        if (matchingPods.length === 0) {
          cy.log(`All target pods deleted after ${elapsed}ms`);
        } else {
          cy.log(`${elapsed}ms - ${matchingPods.length} pod(s) still exist, retrying...`);
          cy.wait(checkIntervalMs).then(checkPods);
        }
      });
    };

    checkPods();
  },
};
