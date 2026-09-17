import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';
import { operatorAuthUtils } from './auth-commands';
import { guidedTour } from '../../views/tour';
import { installTimeoutMilliseconds, readyTimeoutMilliseconds } from '../timeouts';
import { KUBEVIRT_HYPERCONVERGED_OPERATOR } from '../operators';

export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      beforeBlockVirtualization();
      cleanupCNV();
    }
  }
}

const useSession = Cypress.env('SESSION');

const virtualizationUtils = {
  installVirtualization(): void {
    if (Cypress.env('SKIP_CNV_INSTALL')) {
      cy.log('SKIP_CNV_INSTALL is set. Skipping Openshift Virtualization installation.');
    } else if (Cypress.env('CNV_UI_INSTALL')) {
      cy.log(
        'CNV_UI_INSTALL is set. Kubevirt will be installed from redhat-operators catalog source',
      );
      cy.log('Install Openshift Virtualization');
      operatorHubPage.installOperator(
        KUBEVIRT_HYPERCONVERGED_OPERATOR.packageName,
        'redhat-operators',
      );
      cy.get('.co-clusterserviceversion-install__heading', {
        timeout: installTimeoutMilliseconds,
      }).should('include.text', 'Create initialization resource');
    } else if (Cypress.env('KONFLUX_CNV_BUNDLE_IMAGE')) {
      cy.log(
        'KONFLUX_CNV_BUNDLE_IMAGE is set. Openshift Virtualization operator will be installed from Konflux bundle.',
      );
      cy.log('Install Openshift Virtualization');

      cy.adminCLI(`oc create namespace ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace}`);
      cy.adminCLI(
        `operator-sdk run bundle --timeout=10m --namespace ` +
          `${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace} ${Cypress.env(
            'KONFLUX_CNV_BUNDLE_IMAGE',
          )} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('CUSTOM_CNV_BUNDLE_IMAGE')) {
      cy.log(
        'CUSTOM_CNV_BUNDLE_IMAGE is set. Openshift Virtualization operator will be installed from custom built bundle.',
      );
      cy.log('Install Openshift Virtualization');

      cy.adminCLI(`oc create namespace ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace}`);
      cy.adminCLI(
        `operator-sdk run bundle --timeout=10m --namespace ` +
          `${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace} ${Cypress.env(
            'CUSTOM_CNV_BUNDLE_IMAGE',
          )} --verbose `,
        { timeout: installTimeoutMilliseconds },
      );
    } else if (Cypress.env('FBC_STAGE_CNV_IMAGE')) {
      cy.log(
        'FBC_STAGE_CNV_IMAGE is set. Openshift Virtualization operator will be installed from FBC image.',
      );
      cy.log('Install Openshift Virtualization');

      cy.exec('./cypress/fixtures/virtualization/virtualization_stage.sh', {
        env: {
          FBC_STAGE_CNV_IMAGE: Cypress.env('FBC_STAGE_CNV_IMAGE'),
          KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
        },
        timeout: installTimeoutMilliseconds,
      });
    } else {
      throw new Error(
        'No CYPRESS env set for operator installation, check the README for more details.',
      );
    }
  },

  waitForVirtualizationReady(): void {
    cy.log('Check Openshift Virtualization status');
    cy.exec(`oc get csv -n openshift-cnv | grep kubevirt | awk '{print $1}'`)
      .its('stdout') // Get the captured output string
      .then((operatorName) => {
        // Trim any extra whitespace (newline, etc.)
        const CNV_OPERATOR_NAME = operatorName.trim();

        cy.log(`Successfully retrieved Operator Name: ${CNV_OPERATOR_NAME}`);

        // Now, run your actual oc wait command using the captured variable
        cy.exec(
          `sleep 15 && oc wait ` +
            `--for=jsonpath='{.status.phase}'=Succeeded ` +
            `ClusterServiceVersion/${CNV_OPERATOR_NAME} ` +
            `-n ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace} ` +
            `--timeout=300s --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
          {
            timeout: readyTimeoutMilliseconds, // Set a long timeout for the 'oc wait' command
          },
        );
      });

    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.changeNamespace(KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace);

    cy.byTestID('name-filter-input').should('be.visible').type('Openshift Virtualization{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds })
      .eq(0)
      .should('contain.text', 'Succeeded', { timeout: installTimeoutMilliseconds });
  },

  setupHyperconverged(): void {
    if (Cypress.env('SKIP_CNV_INSTALL')) {
      cy.log('Skip Hyperconverged instance creation.');
    } else if (Cypress.env('CNV_UI_INSTALL')) {
      cy.log('Create Hyperconverged instance.');
      cy.exec(`oc get csv -n openshift-cnv | grep kubevirt | awk '{print $1}'`)
        .its('stdout') // Get the captured output string
        .then((operatorName) => {
          // Trim any extra whitespace (newline, etc.)
          const CNV_OPERATOR_NAME = operatorName.trim();
          cy.log(`Successfully retrieved Operator Name: ${CNV_OPERATOR_NAME}`);
          cy.visit(
            `k8s/ns/openshift-cnv/operators.coreos.com~v1alpha1~` +
              `ClusterServiceVersion/${CNV_OPERATOR_NAME}`,
          );
          cy.byOUIAID('OUIA-Generated-Button-primary')
            .contains('Create HyperConverged')
            .should('be.visible')
            .click();
          cy.byTestID('create-dynamic-form').scrollIntoView().should('be.visible').click();
          cy.byTestID('status-text').should('contain.text', 'ReconcileComplete', {
            timeout: installTimeoutMilliseconds,
          });
        });
    } else {
      cy.log('Create Hyperconverged instance.');
      cy.adminCLI(`oc apply -f ./cypress/fixtures/virtualization/hyperconverged.yaml `);
      cy.exec(
        `sleep 15 && oc wait --for=condition=Available --selector=app=kubevirt-hyperconverged -n ${
          KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace
        } --timeout=60s --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
        {
          timeout: readyTimeoutMilliseconds,
          failOnNonZeroExit: true,
        },
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(
          `Hyperconverged is now running in namespace: ` +
            `${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace}`,
        );
      });
    }

    cy.reload(true);
    cy.byLegacyTestID('perspective-switcher-toggle').should('be.visible');
  },

  cleanup(): void {
    const config = KUBEVIRT_HYPERCONVERGED_OPERATOR.config || {
      kind: 'HyperConverged',
      name: 'kubevirt-hyperconverged',
    };
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );

    if (Cypress.env('SKIP_CNV_INSTALL')) {
      cy.log('Maintain Openshift Virtualization');
    } else {
      //https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/virtualization/installing#virt-deleting-virt-cli_uninstalling-virt

      cy.log('Delete Hyperconverged instance.');
      cy.executeAndDelete(
        `oc patch hyperconverged.hco.kubevirt.io/kubevirt-hyperconverged -n ${
          KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace
        } -p '{"metadata":{"finalizers":[]}}' --type=merge --kubeconfig ${kubeconfig}`,
      );

      cy.executeAndDelete(
        `oc patch kubevirt.kubevirt.io/kubevirt -n ${
          KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace
        } --type=merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${kubeconfig}`,
      );

      cy.executeAndDelete(
        `oc delete HyperConverged kubevirt-hyperconverged -n ${
          KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace
        } --ignore-not-found --kubeconfig "${kubeconfig}"`,
      );

      cy.log('Remove Openshift Virtualization subscription');
      cy.executeAndDelete(
        `oc delete subscription ${config.name} -n ${
          KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace
        } --ignore-not-found --kubeconfig "${kubeconfig}"`,
      );

      cy.log('Remove Openshift Virtualization CSV');
      cy.executeAndDelete(
        `oc delete csv -n ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace} ` +
          `-l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv ` +
          `--ignore-not-found --kubeconfig "${kubeconfig}"`,
      );

      cy.log('Remove Openshift Virtualization namespace');
      cy.adminCLI(
        `oc delete namespace ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace} --ignore-not-found ` +
          `--timeout=60s`,
        { failOnNonZeroExit: false, timeout: 90000 },
      ).then((result) => {
        if (result.code !== 0 && result.stderr?.includes('timed out')) {
          cy.log('Namespace stuck in Terminating, removing finalizers');
          cy.exec(
            `oc get namespace ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace} -o json ` +
              `--kubeconfig ${kubeconfig}` +
              ` | jq '.spec.finalizers = []'` +
              ` | oc replace --raw ` +
              `"/api/v1/namespaces/${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace}/finalize" -f - ` +
              `--kubeconfig ${kubeconfig}`,
            { failOnNonZeroExit: false },
          );
        }
      });

      cy.log('Delete Hyperconverged CRD instance.');
      cy.executeAndDelete(
        `oc delete crd --dry-run=client ` +
          `-l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv ` +
          `--ignore-not-found --kubeconfig "${kubeconfig}"`,
      );

      cy.log('Delete Kubevirt instance.');
      cy.adminCLI(
        `oc delete crd ` +
          `-l operators.coreos.com/kubevirt-hyperconverged.openshift-cnv ` +
          `--ignore-not-found --timeout=120s`,
        { failOnNonZeroExit: false, timeout: 150000 },
      );
    }
  },
};

Cypress.Commands.add('beforeBlockVirtualization', () => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateKNVSessionKey();
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Virtualization (session)');

        cy.cleanupCNV();

        operatorAuthUtils.loginAndAuthNoSession();
        virtualizationUtils.installVirtualization();
        virtualizationUtils.waitForVirtualizationReady();
        virtualizationUtils.setupHyperconverged();
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

    cy.cleanupCNV();

    operatorAuthUtils.loginAndAuth();
    virtualizationUtils.installVirtualization();
    virtualizationUtils.waitForVirtualizationReady();
    virtualizationUtils.setupHyperconverged();
    cy.log('Before block Virtualization (no session) completed');
  }
});

Cypress.Commands.add('cleanupCNV', () => {
  cy.log('Cleanup Virtualization (no session)');
  virtualizationUtils.cleanup();
  cy.log('Cleanup Virtualization (no session) completed');
});
