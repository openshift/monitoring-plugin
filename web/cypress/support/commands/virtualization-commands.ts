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
        executeAndDelete(command: string, options?: { timeout?: number });
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

    cy.waitUntil(() => {
      return cy.get('button[data-test-id="perspective-switcher-toggle"]').should('be.visible');
    }, {
      timeout: 30000
    });
  },

  cleanup(KBV: { namespace: string, config?: { kind: string, name: string }, crd?: { kubevirt: string, hyperconverged: string } }): void {
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );

    if (Cypress.env('SKIP_KBV_INSTALL')) {
      cy.log('Maintain Openshift Virtualization');
      
    } else {
      // https://docs.redhat.com/en/documentation/openshift_container_platform/4.21/html/virtualization/installing#virt-deleting-virt-cli_uninstalling-virt

      const kc = `--kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`;
      const cleanupTimeout = { timeout: 300000 };

      cy.log('Delete all VMs and VMIs before uninstalling');
      cy.executeAndDelete(`oc delete vm --all --all-namespaces --ignore-not-found ${kc}`, cleanupTimeout);
      cy.executeAndDelete(`oc delete vmi --all --all-namespaces --ignore-not-found ${kc}`, cleanupTimeout);

      cy.log('Patch finalizers on stuck resources to prevent namespace hang');
      cy.executeAndDelete(`oc patch hyperconverged.hco.kubevirt.io/kubevirt-hyperconverged -n ${KBV.namespace} -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}`);
      cy.executeAndDelete(`oc patch kubevirt.kubevirt.io/kubevirt-kubevirt-hyperconverged -n ${KBV.namespace} -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}`);

      cy.log('Delete HyperConverged custom resource');
      cy.executeAndDelete(`oc delete HyperConverged kubevirt-hyperconverged -n ${KBV.namespace} --ignore-not-found ${kc}`, cleanupTimeout);

      cy.log('Remove stale webhooks to unblock resource deletion');
      cy.executeAndDelete(`oc delete validatingwebhookconfiguration virt-operator-validator virt-api-validator --ignore-not-found ${kc}`);
      cy.executeAndDelete(`oc delete mutatingwebhookconfiguration virt-operator-validator virt-api-validator --ignore-not-found ${kc}`);

      cy.log('Patch remaining finalizers on namespace resources');
      cy.executeAndDelete(`for r in $(oc get migcontrollers.migrations.kubevirt.io -n ${KBV.namespace} -o name ${kc} 2>/dev/null); do oc patch "$r" -n ${KBV.namespace} -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}; done`);
      cy.executeAndDelete(`for r in $(oc get ssps.ssp.kubevirt.io -n ${KBV.namespace} -o name ${kc} 2>/dev/null); do oc patch "$r" -n ${KBV.namespace} -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}; done`);

      cy.log('Delete OpenShift Virtualization Operator subscription');
      cy.executeAndDelete(`oc delete subscription hco-operatorhub -n ${KBV.namespace} --ignore-not-found ${kc}`);

      cy.log('Delete OpenShift Virtualization ClusterServiceVersion');
      cy.executeAndDelete(`oc delete csv -n ${KBV.namespace} -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv --ignore-not-found ${kc}`);

      cy.log('Remove stale API services to unblock namespace deletion');
      cy.executeAndDelete(`oc delete apiservices v1.subresources.kubevirt.io v1alpha3.subresources.kubevirt.io v1beta1.upload.cdi.kubevirt.io --ignore-not-found ${kc}`);

      cy.log('Delete OpenShift Virtualization namespace');
      cy.executeAndDelete(`oc delete namespace ${KBV.namespace} --ignore-not-found ${kc}`, cleanupTimeout);

      cy.log('Patch finalizers on remaining CR instances to unblock CRD deletion');
      cy.executeAndDelete(`for r in $(oc get cdis.cdi.kubevirt.io --all-namespaces -o name ${kc} 2>/dev/null); do oc patch "$r" -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}; done`);
      cy.executeAndDelete(`for r in $(oc get hostpathprovisioners.hostpathprovisioner.kubevirt.io --all-namespaces -o name ${kc} 2>/dev/null); do oc patch "$r" -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}; done`);
      cy.executeAndDelete(`for r in $(oc get networkaddonsconfigs.networkaddonsoperator.network.kubevirt.io --all-namespaces -o name ${kc} 2>/dev/null); do oc patch "$r" -p '{"metadata":{"finalizers":[]}}' --type=merge ${kc}; done`);

      cy.log('List OpenShift Virtualization CRDs (dry-run)');
      cy.executeAndDelete(
        `oc delete crd --dry-run=client -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv --ignore-not-found ${kc}`,
      );

      cy.log('Delete OpenShift Virtualization CRDs');
      cy.executeAndDelete(
        `oc delete crd -l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv --ignore-not-found ${kc}`, cleanupTimeout,
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
          cy.cleanupACM();
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
            cy.waitUntil(() => {
              return cy.get('button[data-test-id="perspective-switcher-toggle"]').should('be.visible');
            }, {
              timeout: 30000
            });
            cy.switchPerspective('Virtualization');
            guidedTour.closeKubevirtTour();

          },
        },
      );
    } else {
      cy.log('Before block Virtualization (no session)');

      cy.cleanupKBV(KBV);
      cy.cleanupACM();
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
