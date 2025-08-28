/* eslint-disable @typescript-eslint/no-use-before-define */
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';


export {};

declare global {
    namespace Cypress {
      interface Chainable {
        adminCLI(command: string, options?);
        executeAndDelete(command: string);
        beforeBlock(MP: { namespace: string, operatorName: string });
        afterBlock(MP: { namespace: string, operatorName: string });
        beforeBlockCOO(MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string});
        afterBlockCOO(MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string});
      }
    }
  }
  

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

Cypress.Commands.add('beforeBlock', (MP: { namespace: string, operatorName: string }) => {
  
    cy.log('Before block');
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );
    // Getting the oauth url for hypershift cluster login
    cy.exec(
      `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    ).then((result) => {
      if (expect(result.stderr).to.be.empty) {
        const oauth = result.stdout;
        // Trimming the origin part of the url
        const oauthurl = new URL(oauth);
        const oauthorigin = oauthurl.origin;
        cy.log(oauthorigin);
        cy.wrap(oauthorigin).as('oauthorigin');
      } else {
        throw new Error(`Execution of oc get oauthclient failed
          Exit code: ${result.code}
          Stdout:\n${result.stdout}
          Stderr:\n${result.stderr}`);
      }
    });
    cy.get('@oauthorigin').then((oauthorigin) => {
      cy.login(
        Cypress.env('LOGIN_IDP'),
        Cypress.env('LOGIN_USERNAME'),
        Cypress.env('LOGIN_PASSWORD'),
        oauthorigin,
      );
    });
  
    cy.log('Set Monitoring Plugin image in operator CSV');
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. the image will be patched in CMO operator CSV');
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
        cy.log(`CMO CSV updated successfully with Monitoring Plugin image: ${result.stdout}`);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }
  
    cy.task('clearDownloads');
    cy.log('Before block completed');
  });
  
  Cypress.Commands.add('afterBlock', (MP: { namespace: string, operatorName: string }) => {
    cy.log('After block');
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
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping reverting the image in CMO operator CSV.');
    }
  
    cy.log('After block completed');
  });
  
  Cypress.Commands.add('beforeBlockCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {
    cy.log('Before block COO');
   
    cy.log('Before all');
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );
    // Getting the oauth url for hypershift cluster login
    cy.exec(
      `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    ).then((result) => {
      if (expect(result.stderr).to.be.empty) {
        const oauth = result.stdout;
        // Trimming the origin part of the url
        const oauthurl = new URL(oauth);
        const oauthorigin = oauthurl.origin;
        cy.log(oauthorigin);
        cy.wrap(oauthorigin).as('oauthorigin');
      } else {
        throw new Error(`Execution of oc get oauthclient failed
              Exit code: ${result.code}
              Stdout:\n${result.stdout}
              Stderr:\n${result.stderr}`);
      }
    });
    cy.get('@oauthorigin').then((oauthorigin) => {
      cy.login(
        Cypress.env('LOGIN_IDP'),
        Cypress.env('LOGIN_USERNAME'),
        Cypress.env('LOGIN_PASSWORD'),
        oauthorigin,
      );
    });
  
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Cluster Observability Operator installation.');
    } else if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. COO will be installed from redhat-operators catalog source');
      cy.log('Install Cluster Observability Operator');
      operatorHubPage.installOperator(MCP.packageName, 'redhat-operators');
      cy.get('.co-clusterserviceversion-install__heading', { timeout: installTimeoutMilliseconds }).should(
        'include.text',
        'Operator installed successfully',
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
        `oc label namespaces ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
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
        `oc label namespaces ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
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
  
    cy.log('Check Cluster Observability Operator status');
    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/name=observability-operator -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Observability-operator pod is now running in namespace: ${MCP.namespace}`);
    });
  
    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      cy.clickNavLink([section, 'Installed Operators']);
    });
  
    cy.byTestID('name-filter-input').should('be.visible').type('Cluster Observability{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds }).eq(0).should('contain.text', 'Succeeded', { timeout: installTimeoutMilliseconds });
  
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
      });
    } else {
      cy.log('MCP_CONSOLE_IMAGE is NOT set. Skipping patching the image in COO operator CSV.');
    }
  
    cy.log('Create PersesDashboard instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/openshift-cluster-sample-dashboard.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  
    cy.log('Create Thanos Querier instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/thanos-querier-datasource.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  
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
    cy.exec(`oc label namespace openshift-cluster-observability-operator openshift.io/cluster-monitoring="true" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`)
    //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - console reload and logout was happening more often
    // cy.get('.pf-v5-c-alert, .pf-v6-c-alert', { timeout: readyTimeoutMilliseconds })
    //   .contains('Web console update is available')
    //   .then(($alert) => {
    //     // If the alert is found, assert that it exists
    //     expect($alert).to.exist;
    //   }, () => {
    //     // If the alert is not found within the timeout, visit and assert the /monitoring/v2/dashboards page
    //     cy.visit('/monitoring/v2/dashboards');
    //     cy.url().should('include', '/monitoring/v2/dashboards');
    //   });
    cy.reload();
    cy.visit('/monitoring/v2/dashboards');
    cy.url().should('include', '/monitoring/v2/dashboards');
  
    cy.log('Set Monitoring Plugin image in operator CSV');
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. the image will be patched in CMO operator CSV');
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
        cy.log(`CMO CSV updated successfully with Monitoring Plugin image: ${result.stdout}`);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }
  
    cy.log('Before block COO completed');
  });
  
  Cypress.Commands.add('afterBlockCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {
    cy.log('After block COO');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('Delete Monitoring UI Plugin instance.');
      cy.executeAndDelete(
        `oc delete ${MCP.config.kind} ${MCP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
  
      cy.log('Remove cluster-admin role from user.');
      cy.executeAndDelete(
        `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
    } else {
      cy.log('Delete Monitoring UI Plugin instance.');
      cy.executeAndDelete(
        `oc delete ${MCP.config.kind} ${MCP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
  
      cy.log('Remove Cluster Observability Operator');
      cy.executeAndDelete(`oc delete namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  
      cy.log('Remove cluster-admin role from user.');
      cy.executeAndDelete(
        `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
  
      cy.executeAndDelete(`oc label namespace openshift-cluster-observability-operator openshift.io/cluster-monitoring- --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`)
  
      //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - console reload and logout was happening more often
      // cy.get('.pf-v5-c-alert, .pf-v6-c-alert', { timeout: 120000 })
      //   .contains('Web console update is available')
      //   .then(($alert) => {
      //     // If the alert is found, assert that it exists
      //     expect($alert).to.exist;
      //   }, () => {
      //     // If the alert is not found within the timeout, visit and assert the /monitoring/v2/dashboards page
      //     cy.visit('/monitoring/v2/dashboards');
      //     cy.url().should('not.include', '/monitoring/v2/dashboards');
      //   });
  
    }
    cy.log('After block COO completed');
  });
