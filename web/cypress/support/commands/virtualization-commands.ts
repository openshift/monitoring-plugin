/* eslint-disable @typescript-eslint/no-use-before-define */
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';
import { operatorAuthUtils } from './operator-commands';
import { guidedTour } from '../../views/tour';

export {};

declare global {
    namespace Cypress {
      interface Chainable {
        adminCLI(command: string, options?);
        executeAndDelete(command: string);
        beforeBlockVirtualization(KBV: { namespace: string, packageName: string });
        cleanupKBV(KBV: { namespace: string, packageName: string });
      }
    }
  }
  
const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

let operatorName;

const useSession = Cypress.env('SESSION');

const virtualizationUtils = {
  installVirtualization(KBV: { namespace: string, packageName: string }): void {
    if (Cypress.env('SKIP_KBV_INSTALL')) {
      cy.log('SKIP_KBV_INSTALL is set. Skipping Openshift Virtualization installation.');
    } else if (Cypress.env('KBV_UI_INSTALL')) {
      cy.log('KBV_UI_INSTALL is set. Kubevirt will be installed from redhat-operators catalog source');
      cy.log('Install Openshift Virtualization');
      operatorHubPage.installOperator(KBV.packageName, 'redhat-operators');
      cy.get('.co-clusterserviceversion-install__heading', { timeout: installTimeoutMilliseconds }).should(
        'include.text',
        'Create initialization resource',
      );

    } else if (Cypress.env('KONFLUX_KBV_BUNDLE_IMAGE')) {
      cy.log('KONFLUX_KBV_BUNDLE_IMAGE is set. Openshift Virtualization operator will be installed from Konflux bundle.');
      cy.log('Install Openshift Virtualization');

      cy.exec(
        `oc create namespace ${KBV.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --namespace ${KBV.namespace} ${Cypress.env('KONFLUX_KBV_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('CUSTOM_KBV_BUNDLE_IMAGE')) {
      cy.log('CUSTOM_KBV_BUNDLE_IMAGE is set. Openshift Virtualization operator will be installed from custom built bundle.');
      cy.log('Install Openshift Virtualization');

      cy.exec(
        `oc create namespace ${KBV.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --namespace ${KBV.namespace} ${Cypress.env('CUSTOM_KBV_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('FBC_STAGE_KBV_IMAGE')) {
      cy.log('FBC_STAGE_KBV_IMAGE is set. Openshift Virtualization operator will be installed from FBC image.');
      cy.log('Install Openshift Virtualization');
      
      cy.exec(
        './cypress/fixtures/virtulization/virtualization_stage.sh',
        {
          env: {
            FBC_STAGE_KBV_IMAGE: Cypress.env('FBC_STAGE_KBV_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
          },
          timeout: installTimeoutMilliseconds
        }
      );
    } else {
      throw new Error('No CYPRESS env set for operator installation, check the README for more details.');
    }
  },

  waitForVirtualizationReady(KBV: { namespace: string}): void {
    cy.log('Check Openshift Virtualization status');
    cy.exec(`oc get csv -n openshift-cnv | grep kubevirt | awk '{print $1}'`)
      .its('stdout') // Get the captured output string
      .then((operatorName) => {
    // Trim any extra whitespace (newline, etc.)
      const KBV_OPERATOR_NAME = operatorName.trim(); 

      cy.log(`Successfully retrieved Operator Name: ${KBV_OPERATOR_NAME}`);

      // Now, run your actual oc wait command using the captured variable
      cy.exec(
        `sleep 15 && oc wait --for=jsonpath='{.status.phase}'=Succeeded ClusterServiceVersion/${KBV_OPERATOR_NAME} -n ${KBV.namespace} --timeout=300s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`
      , {
          timeout: readyTimeoutMilliseconds // Set a long timeout for the 'oc wait' command
        }
      );
    });

    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.changeNamespace(KBV.namespace);

    cy.byTestID('name-filter-input').should('be.visible').type('Openshift Virtualization{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds }).eq(0).should('contain.text', 'Succeeded', { timeout: installTimeoutMilliseconds });

  },

  setupHyperconverged(KBV: { namespace: string}): void {

    if (Cypress.env('SKIP_KBV_INSTALL')) {
      cy.log('Skip Hyperconverged instance creation.');
    } else if (Cypress.env('KBV_UI_INSTALL')) {
      cy.log('Create Hyperconverged instance.');
      cy.exec(`oc get csv -n openshift-cnv | grep kubevirt | awk '{print $1}'`)
        .its('stdout') // Get the captured output string
        .then((operatorName) => {
          // Trim any extra whitespace (newline, etc.)
          const KBV_OPERATOR_NAME = operatorName.trim(); 
          cy.log(`Successfully retrieved Operator Name: ${KBV_OPERATOR_NAME}`);
          cy.visit(`k8s/ns/openshift-cnv/operators.coreos.com~v1alpha1~ClusterServiceVersion/${KBV_OPERATOR_NAME}`);
          cy.byOUIAID('OUIA-Generated-Button-primary').contains('Create HyperConverged').should('be.visible').click();
          cy.byTestID('create-dynamic-form').scrollIntoView().should('be.visible').click();
          cy.byTestID('status-text').should('contain.text', 'ReconcileComplete', { timeout: installTimeoutMilliseconds });
        });
    } else {
      cy.log('Create Hyperconverged instance.');
      cy.exec(`oc apply -f ./cypress/fixtures/virtualization/hyperconverged.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
      cy.exec(
        `sleep 15 && oc wait --for=condition=Available --selector=app=kubevirt-hyperconverged -n ${KBV.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        {
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`Hyperconverged is now running in namespace: ${KBV.namespace}`);
      });
    }

    cy.reload(true);
    cy.byLegacyTestID('perspective-switcher-toggle').should('be.visible');

  },

  cleanup(KBV: { namespace: string, config?: { kind: string, name: string }, crd?: { kubevirt: string, hyperconverged: string } }): void {
    const config = KBV.config || { kind: 'HyperConverged', name: 'kubevirt-hyperconverged' }
    const crd = KBV.crd || { kubevirt: 'kubevirts.kubevirt.io', hyperconverged: 'hyperconvergeds.hco.kubevirt.io' };

    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );

    if (Cypress.env('SKIP_KBV_INSTALL')) {
      cy.log('Maintain Openshift Virtualization');
      
    } else {
      //https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/virtualization/installing#virt-deleting-virt-cli_uninstalling-virt

      cy.log('Delete Hyperconverged instance.');  
      cy.executeAndDelete(`oc patch hyperconverged.hco.kubevirt.io/kubevirt-hyperconverged -n ${KBV.namespace} -p '{"metadata":{"finalizers":[]}}' --type=merge --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.executeAndDelete(`oc patch kubevirt.kubevirt.io/kubevirt -n ${KBV.namespace} --type=merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.executeAndDelete(`oc delete HyperConverged kubevirt-hyperconverged -n ${KBV.namespace} --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
      
      cy.log('Remove Openshift Virtualization subscription');
      cy.executeAndDelete(`oc delete subscription ${config.name} -n ${KBV.namespace} --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove Openshift Virtualization CSV');
      cy.executeAndDelete(`oc delete csv -n ${KBV.namespace} -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove Openshift Virtualization namespace');
      cy.executeAndDelete(`oc delete namespace ${KBV.namespace} --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Delete Hyperconverged CRD instance.');
      cy.executeAndDelete(
        `oc delete crd --dry-run=client -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Delete Kubevirt instance.');
      cy.executeAndDelete(
        `oc delete crd -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

    }
  }
};
  
  Cypress.Commands.add('beforeBlockVirtualization', (KBV: { namespace: string, packageName: string }) => {

    if (useSession) {
      const sessionKey = operatorAuthUtils.generateKBVSessionKey(KBV);
      cy.session(
        sessionKey,
        () => {
          cy.log('Before block Virtualization (session)');

          cy.cleanupKBV(KBV);

          operatorAuthUtils.loginAndAuthNoSession();
          virtualizationUtils.installVirtualization(KBV);
          virtualizationUtils.waitForVirtualizationReady(KBV);
          virtualizationUtils.setupHyperconverged(KBV);
          cy.log('Before block Virtualization (session) completed');
        },
        {
          cacheAcrossSpecs: true,
          validate() {
            cy.validateLogin();
            // Additional validation for Virtualization setup
            cy.switchPerspective('Virtualization');
            guidedTour.closeKubevirtTour();

          },
        },
      );
    } else {
      cy.log('Before block Virtualization (no session)');

      cy.cleanupKBV(KBV);

      operatorAuthUtils.loginAndAuth();
      virtualizationUtils.installVirtualization(KBV);
      virtualizationUtils.waitForVirtualizationReady(KBV);
      virtualizationUtils.setupHyperconverged(KBV);
      cy.log('Before block Virtualization (no session) completed');
    }
  });
  
  Cypress.Commands.add('cleanupKBV', (KBV: { namespace: string, packageName: string }) => {
    cy.log('Cleanup Virtualization (no session)');
    virtualizationUtils.cleanup(KBV);
    cy.log('Cleanup Virtualization (no session) completed');
  });
