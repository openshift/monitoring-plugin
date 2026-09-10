import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';
import { installTimeoutMilliseconds, readyTimeoutMilliseconds } from '../timeouts';

export {};

export const cooInstallUtils = {
  installCOO(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string; packageName: string }): void {
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
      cy.exec(
        `oc label namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
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
        `oc create namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --kubeconfig ` +
          `"${Cypress.env(
            'KUBECONFIG_PATH',
          )}" --dry-run=client -o yaml | oc apply --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}" -f -`,
      );
      cy.exec(
        `oc label namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}"`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --install-mode=AllNamespaces --namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
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
      cy.exec(
        `oc label namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
        } openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig "${Cypress.env(
          'KUBECONFIG_PATH',
        )}"`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --install-mode=AllNamespaces --namespace ${
          CLUSTER_OBSERVABILITY_OPERATOR.namespace
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

  waitForCOOReady(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    cy.log('Check Cluster Observability Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.exec(`oc project ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --kubeconfig ${kubeconfig}`);

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

        cy.exec(
          `oc wait --for=condition=Ready ${podName} -n ` +
            `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --timeout=120s --kubeconfig ${kubeconfig}`,
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

  enableOpenShiftMode(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    if (!Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') && !Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    const ns = CLUSTER_OBSERVABILITY_OPERATOR.namespace;
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

  cleanupCOONamespace(CLUSTER_OBSERVABILITY_OPERATOR: { namespace: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      return;
    }

    cy.log('Remove Cluster Observability Operator namespace');

    // For bundle installs, run operator-sdk cleanup first to remove
    // CatalogSource, registry pod, and other bundle-specific resources.
    // The bundle package name is "observability-operator"
    // (not the CLUSTER_OBSERVABILITY_OPERATOR.packageName
    // which is "cluster-observability-operator" used for catalog installs).
    if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') || Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      cy.exec(
        `operator-sdk cleanup observability-operator -n ` +
          `${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false, timeout: 60000 },
      ).then((result) => {
        if (result.code === 0) {
          cy.log('operator-sdk cleanup completed successfully');
        } else {
          cy.log(`operator-sdk cleanup failed (may not exist): ${result.stderr}`);
        }
      });
    }

    cy.exec(
      `oc get namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: false,
      },
    ).then((checkResult) => {
      if (checkResult.code === 0) {
        cy.log('Namespace exists, proceeding with deletion');

        cy.exec(
          `oc delete csv --all -n ${
            CLUSTER_OBSERVABILITY_OPERATOR.namespace
          } --ignore-not-found --wait=false --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          { timeout: 30000, failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code === 0) {
            cy.log(`CSV deletion initiated in ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`);
          } else {
            cy.log(`CSV deletion failed or not found: ${result.stderr}`);
          }
        });

        cy.exec(
          `oc delete subscription --all -n ${
            CLUSTER_OBSERVABILITY_OPERATOR.namespace
          } --ignore-not-found --wait=false --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          { timeout: 30000, failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code === 0) {
            cy.log(
              `Subscription deletion initiated in ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}`,
            );
          } else {
            cy.log(`Subscription deletion failed or not found: ${result.stderr}`);
          }
        });

        cy.exec(
          `oc delete namespace ${
            CLUSTER_OBSERVABILITY_OPERATOR.namespace
          } --ignore-not-found --wait=false --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
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
              .exec(
                `oc get namespace ${CLUSTER_OBSERVABILITY_OPERATOR.namespace}` +
                  ` --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
                { failOnNonZeroExit: false },
              )
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
