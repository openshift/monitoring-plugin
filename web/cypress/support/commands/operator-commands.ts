/* eslint-disable @typescript-eslint/no-use-before-define */
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';

export { };

declare global {
    namespace Cypress {
      interface Chainable {
        adminCLI(command: string, options?);
        executeAndDelete(command: string);
        beforeBlock(MP: { namespace: string, operatorName: string });
        cleanupMP(MP: { namespace: string, operatorName: string });
        beforeBlockCOO(MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string});
        cleanupCOO(MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string});
        RemoveClusterAdminRole();
        setupCOO(MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string });
        beforeBlockACM( MCP: { namespace: string; operatorName: string; packageName: string }, MP: { namespace: string; operatorName: string },): Chainable<void>;
        closeOnboardingModalIfPresent(): Chainable<void>;
      }
    }
  }
  
const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

const useSession = Cypress.env('SESSION');

// Shared operator utilities
export const operatorAuthUtils = {
  // Core login and auth logic (shared between session and non-session versions)
      performLoginAndAuth(useSession: boolean): void {
      if (`${Cypress.env('LOGIN_USERNAME')}` === 'kubeadmin') {
        cy.adminCLI(
          `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
        );
      } else {
        cy.adminCLI(
          `oc project openshift-monitoring`,
        );
        cy.adminCLI(
          `oc adm policy add-role-to-user monitoring-edit ${Cypress.env('LOGIN_USERNAME')} -n openshift-monitoring`,
        );
        cy.adminCLI(
          `oc adm policy add-role-to-user monitoring-alertmanager-edit --role-namespace openshift-monitoring ${Cypress.env('LOGIN_USERNAME')}`,
        );

        cy.adminCLI(
          `oc adm policy add-role-to-user view ${Cypress.env('LOGIN_USERNAME')} -n openshift-monitoring`,
        );

        cy.adminCLI(
          `oc project default`,
        );

        cy.adminCLI(
          `oc adm policy add-role-to-user monitoring-edit ${Cypress.env('LOGIN_USERNAME')} -n default`,
        );
        cy.adminCLI(
          `oc adm policy add-role-to-user monitoring-alertmanager-edit --role-namespace default ${Cypress.env('LOGIN_USERNAME')}`,
        );

        cy.adminCLI(
          `oc adm policy add-role-to-user view ${Cypress.env('LOGIN_USERNAME')} -n default`,
        );

      }
      cy.exec(
        `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      ).then((result) => {
        if (result.stderr === '') {
          const oauth = result.stdout;
          const oauthurl = new URL(oauth);
          const oauthorigin = oauthurl.origin;
          cy.log(oauthorigin);
          cy.wrap(oauthorigin as string).as('oauthorigin');
        } else {
          throw new Error(`Execution of oc get oauthclient failed
            Exit code: ${result.code}
            Stdout:\\n${result.stdout}
            Stderr:\\n${result.stderr}`);
        }
      });
      cy.get('@oauthorigin').then((oauthorigin) => {
        if (useSession) {
          cy.login(
            Cypress.env('LOGIN_IDP'),
            Cypress.env('LOGIN_USERNAME'),
            Cypress.env('LOGIN_PASSWORD'),
            oauthorigin as unknown as string,
          );
        } else {
          cy.loginNoSession(
            Cypress.env('LOGIN_IDP'),
            Cypress.env('LOGIN_USERNAME'),
            Cypress.env('LOGIN_PASSWORD'),
            oauthorigin as unknown as string,
          );
        }
      });
    },

  loginAndAuth(): void {
    cy.log('Before block');
    operatorAuthUtils.performLoginAndAuth(true);
  },

  loginAndAuthNoSession(): void {
    cy.log('Before block (no session)');
    operatorAuthUtils.performLoginAndAuth(false);
  },

  generateCOOSessionKey(MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      MCP.namespace,
      MCP.operatorName,
      MCP.packageName,
      MP.namespace,
      MP.operatorName
    ];
    
    const envVars = [
      Cypress.env('SKIP_ALL_INSTALL'),
      Cypress.env('SKIP_COO_INSTALL'),
      Cypress.env('COO_UI_INSTALL'),
      Cypress.env('KONFLUX_COO_BUNDLE_IMAGE'),
      Cypress.env('CUSTOM_COO_BUNDLE_IMAGE'),
      Cypress.env('FBC_STAGE_COO_IMAGE'),
      Cypress.env('MP_IMAGE'),
      Cypress.env('MCP_CONSOLE_IMAGE')
    ];
    
    return [...baseKey, ...envVars.filter(Boolean)];
  },

  generateMPSessionKey(MP: { namespace: string, operatorName: string }): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      MP.namespace,
      MP.operatorName
    ];
    
    const envVars = [
      Cypress.env('SKIP_ALL_INSTALL'),
      Cypress.env('MP_IMAGE')
    ];
    
    return [...baseKey, ...envVars.filter(Boolean)];
  },

  generateKBVSessionKey(KBV: { namespace: string, packageName: string }): string[] {
    const baseKey = [
      Cypress.env('LOGIN_IDP'),
      Cypress.env('LOGIN_USERNAME'),
      KBV.namespace,
      KBV.packageName
    ];

    const envVars = [
      Cypress.env('SKIP_KBV_INSTALL'),
      Cypress.env('KBV_UI_INSTALL')
    ];
    
    return [...baseKey, ...envVars.filter(Boolean)];
  }
}

const operatorUtils = {
  setupMonitoringPluginImage(MP: { namespace: string }): void {
    cy.log('Set Monitoring Plugin image in operator CSV');
    if (Cypress.env('MP_IMAGE')) {
      cy.exec(
        './cypress/fixtures/cmo/update-monitoring-plugin-image.sh',
        {
          env: {
            MP_IMAGE: Cypress.env('MP_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MP_NAMESPACE: `${MP.namespace}`
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO deployment Scaled Down successfully: ${result.stdout}`);

      });

        cy.exec(
          `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/name=monitoring-plugin -n ${MP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          {
            timeout: readyTimeoutMilliseconds,
            failOnNonZeroExit: true
          }
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Monitoring plugin pod is now running in namespace: ${MP.namespace}`);
          cy.reload(true);
        });

    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }
  },

  installCOO(MCP: { namespace: string, packageName: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Cluster Observability Operator installation.');
    } else if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. COO will be installed from redhat-operators catalog source');
      cy.log('Install Cluster Observability Operator');
      operatorHubPage.installOperator(MCP.packageName, 'redhat-operators');
      cy.get('.co-clusterserviceversion-install__heading', { timeout: installTimeoutMilliseconds }).should(
        'include.text',
        'ready for use',
      );
      cy.exec(
        `oc label namespace ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
    } else if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')) {
      cy.log('KONFLUX_COO_BUNDLE_IMAGE is set. COO operator will be installed from Konflux bundle.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        `oc create namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `oc label namespace ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --namespace ${MCP.namespace} ${Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      cy.log('CUSTOM_COO_BUNDLE_IMAGE is set. COO operator will be installed from custom built bundle.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        `oc create namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `oc label namespace ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --namespace ${MCP.namespace} ${Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('FBC_STAGE_COO_IMAGE')) {
      cy.log('FBC_COO_IMAGE is set. COO operator will be installed from FBC image.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        './cypress/fixtures/coo/coo_stage.sh',
        {
          env: {
            FBC_STAGE_COO_IMAGE: Cypress.env('FBC_STAGE_COO_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
          },
          timeout: installTimeoutMilliseconds
        }
      );
    } else {
      throw new Error('No CYPRESS env set for operator installation, check the README for more details.');
    }
  },

  waitForCOOReady(MCP: { namespace: string }): void {
    cy.log('Check Cluster Observability Operator status');

    cy.exec(`sleep 60 && oc get pods -n ${MCP.namespace} | grep observability-operator | awk '{print $1}'`, { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true })
    .its('stdout') // Get the captured output string
    .then((podName) => {
      // Trim any extra whitespace (newline, etc.)
      const COO_POD_NAME = podName.trim();
      cy.log(`Successfully retrieved Pod Name: ${COO_POD_NAME}`);
      cy.exec(
        `sleep 15 && oc wait --for=condition=Ready pods ${COO_POD_NAME} -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        {
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`Observability-operator pod is now running in namespace: ${MCP.namespace}`);
      });
    });
    
    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.byTestID('name-filter-input').should('be.visible').type('Cluster Observability{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds }).eq(0).should('contain.text', 'Succeeded', { timeout: installTimeoutMilliseconds });
  },

  setupMonitoringConsolePlugin(MCP: { namespace: string }): void {
    cy.log('Set Monitoring Console Plugin image in operator CSV');
    if (Cypress.env('MCP_CONSOLE_IMAGE')) {
      cy.log('MCP_CONSOLE_IMAGE is set. the image will be patched in COO operator CSV');
      cy.exec(
        './cypress/fixtures/coo/update-mcp-image.sh',
        {
          env: {
            MCP_CONSOLE_IMAGE: Cypress.env('MCP_CONSOLE_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MCP_NAMESPACE: `${MCP.namespace}`
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`COO CSV updated successfully with Monitoring Console Plugin image: ${result.stdout}`);
        cy.reload(true);
      });
    } else {
      cy.log('MCP_CONSOLE_IMAGE is NOT set. Skipping patching the image in COO operator CSV.');
    }
  },

  setupDashboardsAndPlugins(MCP: { namespace: string }): void {

    cy.log('Create perses-dev namespace.');
    cy.exec(`oc new-project perses-dev --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create openshift-cluster-sample-dashboard instance.');
    cy.exec(`sed 's/namespace: openshift-cluster-observability-operator/namespace: ${MCP.namespace}/g' ./cypress/fixtures/coo/openshift-cluster-sample-dashboard.yaml | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create perses-dashboard-sample instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/perses-dashboard-sample.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create prometheus-overview-variables instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/prometheus-overview-variables.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create thanos-compact-overview-1var instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/thanos-compact-overview-1var.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create Thanos Querier instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/thanos-querier-datasource.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.exec(
      `oc label namespace ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );

    cy.log('Create Monitoring UI Plugin instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/monitoring-ui-plugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=monitoring -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Monitoring plugin pod is now running in namespace: ${MCP.namespace}`);
    });

    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=perses -n ${MCP.namespace} --timeout=600s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: installTimeoutMilliseconds,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Perses-0 pod is now running in namespace: ${MCP.namespace}`);
    });

    // cy.exec(
    //   `sleep 15 && oc wait --for=jsonpath='{.metadata.name}'=health-analyzer --timeout=60s servicemonitor/health-analyzer -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    //   {
    //     timeout: readyTimeoutMilliseconds,
    //     failOnNonZeroExit: true
    //   }
    // ).then((result) => {
    //   expect(result.code).to.eq(0);
    //   cy.log(`Health-analyzer service monitor is now running in namespace: ${MCP.namespace}`);
    // });

    cy.reload(true);
    cy.visit('/monitoring/v2/dashboards');
    cy.url().should('include', '/monitoring/v2/dashboards');
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
            MP_NAMESPACE: `${MP.namespace}`
          },
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO CSV reverted successfully with Monitoring Plugin image: ${result.stdout}`);

        cy.exec(
          `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/name=monitoring-plugin -n ${MP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          {
            timeout: readyTimeoutMilliseconds,
            failOnNonZeroExit: false
          }
        ).then((result) => {
          if (result.code === 0) {
            cy.log(`Monitoring plugin pod is now running in namespace: ${MP.namespace}`);
          } else if (result.stderr.includes('no matching resources found')) {
            cy.log(`No monitoring-plugin pods found in namespace ${MP.namespace} - this is expected on fresh clusters`);
          } else {
            throw new Error(`Failed to wait for monitoring-plugin pods: ${result.stderr}`);
          }
        });

        cy.reload(true);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping reverting the image in CMO operator CSV.');
    }
  },

  cleanup(MCP: { namespace: string, config?: { kind: string, name: string } }): void {
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
  
    cy.log('Remove openshift-cluster-sample-dashboard instance.');
    cy.executeAndDelete(`sed 's/namespace: openshift-cluster-observability-operator/namespace: ${MCP.namespace}/g' ./cypress/fixtures/coo/openshift-cluster-sample-dashboard.yaml | oc delete -f - --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove perses-dashboard-sample instance.');
    cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/perses-dashboard-sample.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove prometheus-overview-variables instance.');
    cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/prometheus-overview-variables.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove thanos-compact-overview-1var instance.');
    cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/thanos-compact-overview-1var.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove Thanos Querier instance.');
    cy.executeAndDelete(`oc delete -f ./cypress/fixtures/coo/thanos-querier-datasource.yaml --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove perses-dev namespace');
    cy.executeAndDelete(`oc delete namespace perses-dev --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    // Additional cleanup only when COO is installed
    if (!Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('Remove Cluster Observability Operator namespace');
      
      // First check if the namespace exists
      cy.exec(
        `oc get namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        {
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: false
        }
      ).then((checkResult) => {
        if (checkResult.code === 0) {
          // Namespace exists, proceed with deletion
          cy.log('Namespace exists, proceeding with deletion');

          // Step 1: Delete CSV (ClusterServiceVersion)
          cy.exec(
            `oc delete csv --all -n ${MCP.namespace} --ignore-not-found --wait=false --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            {
              timeout: 30000,
              failOnNonZeroExit: false
            }
          ).then((result) => {
            if (result.code === 0) {
              cy.log(`CSV deletion initiated in ${MCP.namespace}`);
            } else {
              cy.log(`CSV deletion failed or not found: ${result.stderr}`);
            }
          });

          // Step 2: Delete Subscription
          cy.exec(
            `oc delete subscription --all -n ${MCP.namespace} --ignore-not-found --wait=false --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            {
              timeout: 30000,
              failOnNonZeroExit: false
            }
          ).then((result) => {
            if (result.code === 0) {
              cy.log(`Subscription deletion initiated in ${MCP.namespace}`);
            } else {
              cy.log(`Subscription deletion failed or not found: ${result.stderr}`);
            }
          });

          // Step 3: Initiate namespace deletion without waiting (--wait=false prevents timeout)
          cy.exec(
            `oc delete namespace ${MCP.namespace} --ignore-not-found --wait=false --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            {
              timeout: 30000, // Short timeout since we're not waiting
              failOnNonZeroExit: false
            }
          ).then((result) => {
            if (result.code === 0) {
              cy.log(`Namespace deletion initiated for ${MCP.namespace}`);
            } else {
              cy.log(`Failed to initiate deletion: ${result.stderr}`);
            }
          });


          const checkIntervalMs = 15000; // Check every 15 seconds
          const startTime = Date.now();
          const maxWaitTimeMs = 600000; //10min
        
          const checkStatus = () => {
            const elapsed = Date.now() - startTime;
        
            if (elapsed > maxWaitTimeMs) {
              cy.log(`${elapsed}ms - Timeout reached (${maxWaitTimeMs / 60000}m). Namespace ${MCP.namespace} still terminating. Attempting force-delete.`);
              // Execute the shell script to remove finalizers
              return cy.exec(`./cypress/fixtures/coo/force_delete_ns.sh ${MCP.namespace} ${Cypress.env('KUBECONFIG_PATH')}`, 
                { failOnNonZeroExit: false, timeout: installTimeoutMilliseconds }).then((result) => {
                cy.log(`${elapsed}ms - Force delete output: ${result.stdout}`);
                if (result.code !== 0) {
                  cy.log(`Force delete failed with exit code ${result.code}: ${result.stderr}`);
                }
              });
            }
        
            // Command to check the namespace status
            // Use 'oc get ns -o jsonpath' for minimal output and fastest check
            cy.exec(`oc get ns ${MCP.namespace} --kubeconfig ${`${Cypress.env('KUBECONFIG_PATH')}`} -o jsonpath='{.status.phase}'`, { failOnNonZeroExit: false })
              .then((result) => {
                const status = result.stdout.trim();
        
                if (status === 'Terminating') {
                  cy.log(`${elapsed}ms - ${MCP.namespace} is still 'Terminating'. Retrying in ${checkIntervalMs / 1000}s. Elapsed: ${Math.round(elapsed / 1000)}s`);
                  cy.exec(
                          `./cypress/fixtures/coo/force_delete_ns.sh ${MCP.namespace} ${Cypress.env('KUBECONFIG_PATH')}`,
                          { failOnNonZeroExit: false, timeout: installTimeoutMilliseconds }
                        ).then((forceResult) => {
                          cy.log(`${elapsed}ms - Force delete output: ${forceResult.stdout}`);
                          if (forceResult.code !== 0) {
                            cy.log(`Force delete failed with exit code ${forceResult.code}: ${forceResult.stderr}`);
                          }
                        });
                  // Wait and call recursively
                  cy.wait(checkIntervalMs).then(checkStatus);
                } else if (status === 'NotFound') {
                  cy.log(`${elapsed}ms - ${MCP.namespace} is successfully deleted.`);
                  // Stop recursion
                } else {
                  // Handles 'Active' or other unexpected states if the delete command failed silently earlier
                  cy.log(`${elapsed}ms - ${MCP.namespace} changed to unexpected state: ${status}. Stopping monitoring.`);
                }
              });
          };
          
          checkStatus();

          cy.then(() => {
            operatorUtils.waitForPodsDeleted(MCP.namespace);
          });

        } else {
          cy.log('Namespace does not exist, skipping deletion');
        }
      });
    }
  },

  waitForPodsDeleted(namespace: string, maxWaitMs: number = 120000): void {
    const kubeconfigPath = Cypress.env('KUBECONFIG_PATH');
    const checkIntervalMs = 5000;
    const startTime = Date.now();
    const podPatterns = 'monitoring|perses|perses-0|health-analyzer|troubleshooting-panel|korrel8r';
    
    const checkPods = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > maxWaitMs) {
        throw new Error(`Timeout: Pods still exist after ${maxWaitMs / 1000}s`);
      }
      
      cy.exec(
        `oc get pods -n ${namespace} --kubeconfig ${kubeconfigPath} -o name 2>&1 | grep -E '${podPatterns}' | wc -l`,
        { failOnNonZeroExit: false }
      ).then((result) => {
        const count = parseInt(result.stdout.trim(), 10);
        
        if (count === 0 || result.stderr.includes('not found')) {
          cy.log(`✓ All target pods deleted after ${elapsed}ms`);
        } else {
          cy.log(`${elapsed}ms - ${count} pod(s) still exist, retrying...`);
          cy.wait(checkIntervalMs).then(checkPods);
        }
      });
    };
    
    checkPods();
  },

  RemoveClusterAdminRole(): void {
    cy.log('Remove cluster-admin role from user.');
    cy.executeAndDelete(
      `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );
  },

  collectDebugInfo(MP: { namespace: string }, MCP?: { namespace: string }): void {
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
};

Cypress.Commands.add('beforeBlock', (MP: { namespace: string, operatorName: string }) => {    
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateMPSessionKey(MP);
    
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block (session)');
        
        // Clean up any existing setup first
        cy.cleanupMP(MP);
        
        // Then set up fresh
        operatorAuthUtils.loginAndAuthNoSession();
        operatorUtils.setupMonitoringPluginImage(MP);
        operatorUtils.collectDebugInfo(MP);
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
    operatorUtils.setupMonitoringPluginImage(MP);
    operatorUtils.collectDebugInfo(MP);
    cy.task('clearDownloads');
    cy.log('Before block (no session) completed');
  }
  });
  
  Cypress.Commands.add('cleanupMP', (MP: { namespace: string, operatorName: string }) => {
    if (useSession) {
      cy.log('cleanupMP (session)');
      operatorUtils.revertMonitoringPluginImage(MP);
      cy.log('cleanupMP (no session) completed');
    }
  });
  
  Cypress.Commands.add('beforeBlockCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {

    if (useSession) {
      const sessionKey = operatorAuthUtils.generateCOOSessionKey(MCP, MP);
      
      cy.session(
        sessionKey,
        () => {
          cy.log('Before block COO (session)');
          
          cy.cleanupCOO(MCP, MP);
          // Then set up fresh
          operatorAuthUtils.loginAndAuthNoSession();
          cy.setupCOO(MCP, MP);
          cy.log('Before block COO (session) completed');
        },
        {
          cacheAcrossSpecs: true,
          validate() {
            cy.validateLogin();
            // Additional validation for COO setup
            cy.visit('/monitoring/v2/dashboards');
            cy.url().should('include', '/monitoring/v2/dashboards');
          },
        },
      );
    } else {
      cy.log('Before block COO (no session)');

      cy.cleanupCOO(MCP, MP);

      operatorAuthUtils.loginAndAuth();
      cy.setupCOO(MCP, MP);
      cy.log('Before block COO (no session) completed');
    }
  });
  
  Cypress.Commands.add('cleanupCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {
    cy.log('Cleanup COO (no session)');
    if (Cypress.env('SKIP_ALL_INSTALL')) {
      cy.log('SKIP_ALL_INSTALL is set. Skipping COO cleanup and operator verifications (preserves existing setup).');
      return;
    }
    // operatorUtils.cleanupTroubleshootingPanel(MCP);
    operatorUtils.cleanup(MCP);
    operatorUtils.revertMonitoringPluginImage(MP);
    cy.log('Cleanup COO (no session) completed');
  });

  Cypress.Commands.add('setupCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {
    if (Cypress.env('SKIP_ALL_INSTALL')) {
      cy.log('SKIP_ALL_INSTALL is set. Skipping COO setup and operator verifications (uses existing installation).');
      return;
    }
    operatorUtils.installCOO(MCP);
    operatorUtils.waitForCOOReady(MCP);
    operatorUtils.setupMonitoringConsolePlugin(MCP);
    operatorUtils.setupDashboardsAndPlugins(MCP);
    // operatorUtils.setupTroubleshootingPanel(MCP);
    operatorUtils.setupMonitoringPluginImage(MP);
    operatorUtils.RemoveClusterAdminRole();
    operatorUtils.collectDebugInfo(MP, MCP);
  });

  Cypress.Commands.add('RemoveClusterAdminRole', () => {
    cy.log('Remove cluster-admin role from user.');
    operatorUtils.RemoveClusterAdminRole();
    cy.log('Remove cluster-admin role from user completed');
  });

Cypress.Commands.add('beforeBlockACM', (MCP, MP) => {
  cy.beforeBlockCOO(MCP, MP);
  cy.log('=== [Setup] Installing ACM Operator & MCO ===');
  cy.exec('bash ./cypress/fixtures/coo/acm-install.sh', {
    env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH'), },
    failOnNonZeroExit: false,
    timeout: 1200000, // long time script
  });
  cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-uiplugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  // add example alerts for test
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
