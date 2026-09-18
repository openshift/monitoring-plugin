import 'cypress-wait-until';
import { installTimeoutMilliseconds, readyTimeoutMilliseconds } from '../timeouts';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';
import { operatorAuthUtils } from './auth-commands';
import {
  CLUSTER_LOGGING_OPERATOR,
  LOKI_OPERATOR,
  OPENTELEMETRY_OPERATOR,
  TEMPO_OPERATOR,
} from '../operators';

export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      beforeBlockOtel();
      beforeBlockTempo();
      configureBase();
      configureTracingApps();
      installDistributeTracingUIPlugin();
      waitForDistributeTracingUIPluginReady();

      beforeBlockLoki();
      beforeBlockLogging();
      configureLoggingLoki();
      installLoggingUIPlugin();
      waitForLoggingUIPluginReady();

      cleanupOtel();
      cleanupTempo();
      cleanupBase();
      cleanupTracingApps();
      cleanupTempoLokiThanosPersesGlobalDatasource();
      cleanupDistributeTracingUIPlugin();
      cleanupLoki();
      cleanupLogging();
      cleanupLoggingLoki();
      cleanupLoggingUIPlugin();
      cleanupChainsawNamespaces();

      createTempoLokiThanosPersesGlobalDatasource();
    }
  }
}

const useSession = String(Cypress.env('SESSION')).toLowerCase() === 'true';

const DISTRIBUTING_TRACING_PLUGIN = {
  namespace: Cypress.env('COO_NAMESPACE'),
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'distributed-tracing',
  },
};

const LOGGING_PLUGIN = {
  namespace: Cypress.env('COO_NAMESPACE'),
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'logging',
  },
};

const tracesUtils = {
  installOtel(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping OpenTelemetry Operator installation.');
      return;
    }

    cy.log('Install Red Hat build of OpenTelemetry');
    operatorHubPage.installOperator(OPENTELEMETRY_OPERATOR.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Operator installed successfully'),
      );
    });
  },

  waitForOtelReady(): void {
    cy.log('Check OpenTelemetry Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${OPENTELEMETRY_OPERATOR.namespace} -o name ` +
              `--kubeconfig ${kubeconfig} ` +
              '| grep opentelemetry',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg:
          `OpenTelemetry operator pod not found in namespace ` +
          `${OPENTELEMETRY_OPERATOR.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${OPENTELEMETRY_OPERATOR.namespace} -o name --kubeconfig ${kubeconfig} ` +
        '| grep opentelemetry',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found OpenTelemetry pod: ${podName}`);

        cy.adminCLI(
          `oc wait --for=condition=Ready ${podName} -n ${OPENTELEMETRY_OPERATOR.namespace} ` +
            `--timeout=120s`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(
            `OpenTelemetry operator pod is now running in namespace: ` +
              `${OPENTELEMETRY_OPERATOR.namespace}`,
          );
        });
      });

    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.byTestID('name-filter-input').should('be.visible').type('OpenTelemetry{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds })
      .eq(0)
      .should('contain.text', 'Succeeded');
  },

  cleanupOtel(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping OpenTelemetry Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Remove OpenTelemetry Operator');
    cy.executeAndDelete(
      `oc delete namespace ${OPENTELEMETRY_OPERATOR.namespace} --kubeconfig ${kubeconfig}`,
    );
  },

  installTempo(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tempo Operator installation.');
      return;
    }

    cy.log('Install Tempo Operator');
    operatorHubPage.installOperator(TEMPO_OPERATOR.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Operator installed successfully'),
      );
    });
  },

  waitForTempoReady(): void {
    cy.log('Check Tempo Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${TEMPO_OPERATOR.namespace} -o name --kubeconfig ${kubeconfig} ` +
              '| grep tempo',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `Tempo operator pod not found in namespace ${TEMPO_OPERATOR.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${TEMPO_OPERATOR.namespace} -o name --kubeconfig ${kubeconfig} ` +
        '| grep tempo',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found Tempo pod: ${podName}`);

        cy.adminCLI(
          `oc wait --for=condition=Ready ${podName} -n ${TEMPO_OPERATOR.namespace} --timeout=120s`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Tempo operator pod is now running in namespace: ${TEMPO_OPERATOR.namespace}`);
        });
      });

    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.byTestID('name-filter-input').should('be.visible').type('Tempo{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds })
      .eq(0)
      .should('contain.text', 'Succeeded');
  },

  cleanupTempo(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tempo Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Tempo Operator namespace');
    cy.executeAndDelete(
      `oc delete namespace ${TEMPO_OPERATOR.namespace} --kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Tempo Operator resource');
    cy.adminCLI(`oc delete operator tempo-product.${TEMPO_OPERATOR.namespace}`, {
      timeout: readyTimeoutMilliseconds,
      failOnNonZeroExit: false,
    });

    cy.log('Delete Tempo CustomResourceDefinitions');
    const tempoCRs = ['tempomonolithics.tempo.grafana.com', 'tempostacks.tempo.grafana.com'];
    tempoCRs.forEach((cr) => {
      cy.exec(
        `oc get ${cr} -A -o name --kubeconfig ${kubeconfig} 2>/dev/null` +
          ` | xargs --no-run-if-empty -I {} sh -c` +
          ` 'oc patch {} -A --type=merge -p "{\\"metadata\\":{\\"finalizers\\":[]}}"` +
          ` --kubeconfig ${kubeconfig} 2>/dev/null; oc delete {} -A --force --grace-period=0` +
          ` --kubeconfig ${kubeconfig} 2>/dev/null' || true`,
        { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: false },
      );
      cy.adminCLI(`oc patch crd ${cr} -p '{"metadata":{"finalizers":[]}}' --type=merge`, {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: false,
      });
      cy.adminCLI(`oc delete crd ${cr} --force --grace-period=0 --wait=false --ignore-not-found`, {
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: false,
      });
    });
  },

  cleanupChainsawNamespaces(): void {
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Chainsaw namespaces if they exist');
    cy.exec(
      `for ns in $(oc get projects -o name --kubeconfig ${kubeconfig} ` +
        '| grep "chainsaw-" | sed \'s|project.project.openshift.io/||\'); do ' +
        // eslint-disable-next-line max-len
        `oc get opentelemetrycollectors.opentelemetry.io,tempostacks.tempo.grafana.com,tempomonolithics.tempo.grafana.com,pvc ` +
        `-n $ns -o name --kubeconfig ${kubeconfig} 2>/dev/null ` +
        `| xargs --no-run-if-empty -I {} oc patch {} -n $ns --type merge ` +
        `-p '{"metadata":{"finalizers":[]}}' --kubeconfig ${kubeconfig} 2>/dev/null || true; ` +
        `oc delete project $ns --kubeconfig ${kubeconfig} || true; done`,
      {
        timeout: 300000,
        failOnNonZeroExit: false,
      },
    );
  },

  installDistributeTracingUIPlugin(): void {
    cy.log('Create Distributed Tracing UI Plugin instance.');
    cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/traces/tracing-ui-plugin.yaml`);
    cy.exec(
      // eslint-disable-next-line max-len
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=distributed-tracing -n ${
        DISTRIBUTING_TRACING_PLUGIN.namespace
      } --timeout=60s --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      {
        timeout: 80000,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(
        `Distributed Tracing Console plugin pod is now running in namespace: ` +
          `${DISTRIBUTING_TRACING_PLUGIN.namespace}`,
      );
    });
    // Check for web console update alert for up to 2 minutes
    // (especially important for Hypershift clusters)
    cy.log('Checking for web console update alert for up to 2 minutes...');
    cy.checkForAlertRecursively();
  },

  waitForDistributeTracingUIPluginReady(): void {
    cy.visit('/observe/traces');
    cy.url().should('include', '/observe/traces');
    cy.get('body').should('be.visible');
    // Wait for the page to fully render
    cy.wait(3000);
  },

  cleanupDistributeTracingUIPlugin(): void {
    cy.log('Cleanup Distributed Tracing UI Plugin');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Distributed Tracing UI Plugin cleanup.');
      return;
    }
    cy.adminCLI(
      `oc delete ${DISTRIBUTING_TRACING_PLUGIN.config.kind} ` +
        `${DISTRIBUTING_TRACING_PLUGIN.config.name}`,
      { failOnNonZeroExit: false },
    );
    cy.log('Cleanup Distributed Tracing UI Plugin completed');
  },

  configureBase(): void {
    cy.log('Configure Tempo');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tempo configuration.');
      return;
    }
    const savedStatePath = 'cypress/fixtures/coo/traces/.original-monitoring-config.json';

    // Read and store the existing enableUserWorkload value, then patch
    cy.adminCLI(
      `oc get configmap cluster-monitoring-config -n openshift-monitoring
      -o jsonpath='{.data["config.yaml"]}'`,
      { failOnNonZeroExit: false },
    ).then((result) => {
      const configMapExists = result.code === 0;
      const originalConfigYaml = configMapExists ? result.stdout : '';

      // Save original state for cleanup restoration
      cy.writeFile(savedStatePath, {
        existed: configMapExists,
        configYaml: originalConfigYaml,
      });

      if (!configMapExists) {
        // ConfigMap doesn't exist, create it with just the needed setting
        cy.adminCLI(
          `oc create configmap cluster-monitoring-config -n openshift-monitoring ` +
            `--from-literal=config.yaml='enableUserWorkload: true'`,
          { failOnNonZeroExit: false },
        );
      } else if (!originalConfigYaml.includes('enableUserWorkload: true')) {
        // Patch existing ConfigMap to set enableUserWorkload: true
        let newConfig: string;
        if (originalConfigYaml.includes('enableUserWorkload')) {
          newConfig = originalConfigYaml.replace(
            /enableUserWorkload:.*/,
            'enableUserWorkload: true',
          );
        } else {
          newConfig = originalConfigYaml
            ? `enableUserWorkload: true\n${originalConfigYaml}`
            : 'enableUserWorkload: true';
        }
        const patch = JSON.stringify({
          data: { 'config.yaml': newConfig },
        });
        cy.adminCLI(
          `oc patch configmap cluster-monitoring-config -n openshift-monitoring ` +
            `--type merge -p '${patch}'`,
          { failOnNonZeroExit: false },
        );
      }
    });

    // Apply the rest of base.yaml (no longer contains cluster-monitoring-config)
    cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/traces/base.yaml`, {
      failOnNonZeroExit: false,
    });
  },

  cleanupBase(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Base cleanup.');
      return;
    }
    const savedStatePath = 'cypress/fixtures/coo/traces/.original-monitoring-config.json';

    // Restore cluster-monitoring-config if we saved its original state
    cy.exec(`test -f ${savedStatePath}`, {
      failOnNonZeroExit: false,
    }).then((testResult) => {
      if (testResult.code === 0) {
        cy.readFile(savedStatePath).then((original: { existed: boolean; configYaml: string }) => {
          if (!original.existed) {
            // ConfigMap didn't exist before we created it, so delete it
            cy.adminCLI(
              `oc delete configmap cluster-monitoring-config
              -n openshift-monitoring`,
              { failOnNonZeroExit: false },
            );
          } else {
            // Restore original config.yaml value
            const patch = JSON.stringify({
              data: { 'config.yaml': original.configYaml },
            });
            cy.adminCLI(
              `oc patch configmap cluster-monitoring-config -n openshift-monitoring ` +
                `--type merge -p '${patch}'`,
              { failOnNonZeroExit: false },
            );
          }
          // Clean up the saved state file
          cy.exec(`rm -f ${savedStatePath}`, {
            failOnNonZeroExit: false,
          });
        });
      }
    });

    // Delete the rest of base.yaml resources
    cy.adminCLI(`oc delete -f ./cypress/fixtures/coo/traces/base.yaml`, {
      failOnNonZeroExit: false,
      timeout: installTimeoutMilliseconds,
    });
  },

  configureTracingApps(): void {
    cy.log('Configure Tracing Apps');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tracing Apps configuration.');
      return;
    }
    cy.exec(
      `oc apply -f ./cypress/fixtures/coo/traces/tracing-apps.yaml --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
      { failOnNonZeroExit: false },
    );
  },

  cleanupTracingApps(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tracing Apps cleanup.');
      return;
    }
    cy.adminCLI(`oc delete -f ./cypress/fixtures/coo/traces/tracing-apps.yaml`, {
      failOnNonZeroExit: false,
    });
  },
};

const loggingUtils = {
  installLoki(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Loki Operator installation.');
      return;
    }

    cy.log('Install Loki Operator');
    operatorHubPage.installOperator(LOKI_OPERATOR.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Operator installed successfully'),
      );
    });
  },

  cleanupLoki(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Loki Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Loki Operator namespace');
    cy.executeAndDelete(
      `oc delete namespace ${LOKI_OPERATOR.namespace} --kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Loki Operator resource');
    cy.executeAndDelete(
      `oc delete operator loki-operator.${LOKI_OPERATOR.namespace} --kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Loki CustomResourceDefinitions');
    cy.executeAndDelete(
      `oc delete customresourcedefinitions.apiextensions.k8s.io ` +
        `lokistacks.loki.grafana.com --ignore-not-found --kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Loki Operator CRDs');
    cy.executeAndDelete(
      `oc delete crds lokistacks.loki.grafana.com --ignore-not-found --kubeconfig ${kubeconfig}`,
    );
  },

  installLogging(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Operator installation.');
      return;
    }

    cy.log('Install Logging Operator');
    operatorHubPage.installOperator(CLUSTER_LOGGING_OPERATOR.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Create initialization resource'),
      );
    });
  },

  cleanupLogging(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Logging Operator namespace');
    cy.executeAndDelete(
      `oc delete namespace ${CLUSTER_LOGGING_OPERATOR.namespace} --kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Logging Operator resource');
    cy.executeAndDelete(
      `oc delete operator cluster-logging.${CLUSTER_LOGGING_OPERATOR.namespace} ` +
        `--kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Logging CustomResourceDefinitions');
    cy.executeAndDelete(
      `oc delete customresourcedefinitions.apiextensions.k8s.io ` +
        `logging.openshift.io --ignore-not-found --kubeconfig ${kubeconfig}`,
    );

    cy.log('Delete Logging Operator CRDs');
    cy.executeAndDelete(
      `oc delete crds logging.openshift.io --ignore-not-found --kubeconfig ${kubeconfig}`,
    );
  },

  waitForLokiReady(): void {
    cy.log('Check Loki Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${LOKI_OPERATOR.namespace} -o name --kubeconfig ${kubeconfig} ` +
              '| grep loki',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `Loki operator pod not found in namespace ${LOKI_OPERATOR.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${LOKI_OPERATOR.namespace} -o name --kubeconfig ${kubeconfig} ` +
        '| grep loki',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found Loki pod: ${podName}`);

        cy.adminCLI(
          `oc wait --for=condition=Ready ${podName} -n ${LOKI_OPERATOR.namespace} --timeout=120s`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Loki operator pod is now running in namespace: ${LOKI_OPERATOR.namespace}`);
        });
      });

    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.byTestID('name-filter-input').should('be.visible').type('Loki{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds })
      .eq(0)
      .should('contain.text', 'Succeeded');
  },

  waitForLoggingReady(): void {
    cy.log('Check Logging Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${CLUSTER_LOGGING_OPERATOR.namespace} -o name --kubeconfig ` +
              `${kubeconfig} | grep logging`,
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg:
          `Logging operator pod not found in namespace ` + `${CLUSTER_LOGGING_OPERATOR.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${CLUSTER_LOGGING_OPERATOR.namespace} -o name --kubeconfig ${kubeconfig} ` +
        '| grep logging',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found Logging pod: ${podName}`);

        cy.adminCLI(
          `oc wait --for=condition=Ready ${podName} -n ${CLUSTER_LOGGING_OPERATOR.namespace} ` +
            `--timeout=120s`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(
            `Logging operator pod is now running in namespace: ` +
              `${CLUSTER_LOGGING_OPERATOR.namespace}`,
          );
        });
      });

    cy.get('#page-sidebar').then(($sidebar) => {
      const section = $sidebar.text().includes('Ecosystem') ? 'Ecosystem' : 'Operators';
      nav.sidenav.clickNavLink([section, 'Installed Operators']);
    });

    cy.byTestID('name-filter-input').should('be.visible').type('Logging{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds })
      .eq(0)
      .should('contain.text', 'Succeeded');
  },

  installLoggingUIPlugin(): void {
    cy.log('Install Logging UI Plugin');
    cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/logging/logging-ui-plugin.yaml`);
    cy.log('Install Logging UI Plugin completed');

    cy.exec(
      // eslint-disable-next-line max-len
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=logging -n ${
        LOGGING_PLUGIN.namespace
      } --timeout=60s --kubeconfig "${Cypress.env('KUBECONFIG_PATH')}"`,
      {
        timeout: 80000,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Logging UI Plugin pod is now running in namespace: ${LOGGING_PLUGIN.namespace}`);
    });
    // Check for web console update alert for up to 2 minutes
    // (especially important for Hypershift clusters)
    cy.log('Checking for web console update alert for up to 2 minutes...');
    cy.checkForAlertRecursively();
    cy.log('Logging UI Plugin installed successfully');
  },

  waitForLoggingUIPluginReady(): void {
    cy.visit('/monitoring/logs');
    cy.url().should('include', '/monitoring/logs');
    cy.get('body').should('be.visible');
    // Wait for the page to fully render
    cy.wait(3000);
  },

  cleanupLoggingUIPlugin(): void {
    cy.log('Cleanup Logging UI Plugin');
    cy.adminCLI(`oc delete ${LOGGING_PLUGIN.config.kind} ${LOGGING_PLUGIN.config.name}`, {
      failOnNonZeroExit: false,
    });
    cy.log('Cleanup Logging UI Plugin completed');
  },

  configureLoggingLoki(): void {
    cy.log('Configure Logging Loki');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Loki configuration.');
      return;
    }
    cy.adminCLI(`oc apply -f ./cypress/fixtures/coo/logging/base.yaml`, {
      failOnNonZeroExit: false,
    });
    cy.adminCLI(`oc project openshift-logging`);
    cy.adminCLI(`oc create sa collector -n openshift-logging`, {
      failOnNonZeroExit: false,
    });
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user logging-collector-logs-writer -z collector`,
      { failOnNonZeroExit: false },
    );
    cy.adminCLI(`oc adm policy add-cluster-role-to-user collect-application-logs -z collector`, {
      failOnNonZeroExit: false,
    });
    cy.adminCLI(`oc adm policy add-cluster-role-to-user collect-audit-logs -z collector`, {
      failOnNonZeroExit: false,
    });
    cy.adminCLI(`oc adm policy add-cluster-role-to-user collect-infrastructure-logs -z collector`, {
      failOnNonZeroExit: false,
    });

    cy.exec(`./cypress/fixtures/coo/logging/make-resources.sh`, {
      env: {
        KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
      },
      timeout: installTimeoutMilliseconds,
      failOnNonZeroExit: false,
    });

    cy.log('Configure Logging Loki completed');
  },

  cleanupLoggingLoki(): void {
    cy.log('Cleanup Logging Loki');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Loki cleanup.');
      return;
    }
    cy.adminCLI(`oc delete -f ./cypress/fixtures/coo/logging/base.yaml`, {
      failOnNonZeroExit: false,
    });
    cy.exec(`./cypress/fixtures/coo/logging/make-clean-resources.sh`, {
      env: {
        KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
      },
      timeout: installTimeoutMilliseconds,
      failOnNonZeroExit: false,
    });
    cy.log('Cleanup Logging Loki completed');
  },
};

const persesUtils = {
  createTempoLokiThanosPersesGlobalDatasource(): void {
    cy.log('Create Tempo Loki Thanos Perses Global Datasource');
    cy.adminCLI(`oc apply -f ./cypress/fixtures/perses/perses-global-datasources.yaml`, {
      failOnNonZeroExit: false,
    });
  },

  cleanupTempoLokiThanosPersesGlobalDatasource(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log(
        'SKIP_COO_INSTALL is set. Skipping Tempo Loki Thanos Perses Global Datasource cleanup.',
      );
      return;
    }
    cy.adminCLI(`oc delete -f ./cypress/fixtures/perses/perses-global-datasources.yaml`, {
      failOnNonZeroExit: false,
    });
  },
};

// ── Cypress commands ───────────────────────────────────────────────

Cypress.Commands.add('beforeBlockOtel', () => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey(
      'otel',
      OPENTELEMETRY_OPERATOR,
    );
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block OpenTelemetry (session)');
        cy.cleanupOtel();
        operatorAuthUtils.loginAndAuthNoSession();
        tracesUtils.installOtel();
        tracesUtils.waitForOtelReady();
        cy.log('Before block OpenTelemetry (session) completed');
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
        },
      },
    );
  } else {
    cy.log('Before block OpenTelemetry (no session)');
    cy.cleanupOtel();
    operatorAuthUtils.loginAndAuth();
    tracesUtils.installOtel();
    tracesUtils.waitForOtelReady();
    cy.log('Before block OpenTelemetry (no session) completed');
  }
});

Cypress.Commands.add('beforeBlockTempo', () => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey('tempo', TEMPO_OPERATOR);
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Tempo (session)');
        cy.cleanupTempoLokiThanosPersesGlobalDatasource();
        cy.cleanupBase();
        cy.cleanupTracingApps();
        cy.cleanupTempo();
        tracesUtils.cleanupChainsawNamespaces();
        operatorAuthUtils.loginAndAuthNoSession();
        tracesUtils.installTempo();
        tracesUtils.waitForTempoReady();
        cy.log('Before block Tempo (session) completed');
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
        },
      },
    );
  } else {
    cy.log('Before block Tempo (no session)');
    cy.cleanupTempoLokiThanosPersesGlobalDatasource();
    cy.cleanupBase();
    cy.cleanupTracingApps();
    cy.cleanupTempo();
    tracesUtils.cleanupChainsawNamespaces();
    operatorAuthUtils.loginAndAuth();
    tracesUtils.installTempo();
    tracesUtils.waitForTempoReady();
    cy.log('Before block Tempo (no session) completed');
  }
});

Cypress.Commands.add('beforeBlockLoki', () => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey('loki', LOKI_OPERATOR);
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Loki (session)');
        cy.cleanupLoggingLoki();
        cy.cleanupLoki();
        operatorAuthUtils.loginAndAuthNoSession();
        loggingUtils.installLoki();
        loggingUtils.waitForLokiReady();
        cy.log('Before block Loki (session) completed');
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
        },
      },
    );
  } else {
    cy.log('Before block Loki (no session)');
    cy.cleanupLoggingLoki();
    cy.cleanupLoki();
    operatorAuthUtils.loginAndAuth();
    loggingUtils.installLoki();
    loggingUtils.waitForLokiReady();
    cy.log('Before block Loki (no session) completed');
  }
});

Cypress.Commands.add('beforeBlockLogging', () => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey(
      'logging',
      CLUSTER_LOGGING_OPERATOR,
    );
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Logging (session)');
        cy.cleanupLogging();
        cy.cleanupLoggingLoki();
        operatorAuthUtils.loginAndAuthNoSession();
        loggingUtils.installLogging();
        loggingUtils.waitForLoggingReady();
        cy.log('Before block Logging (session) completed');
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.validateLogin();
        },
      },
    );
  } else {
    cy.log('Before block Logging (no session)');
    cy.cleanupLogging();
    cy.cleanupLoggingLoki();
    operatorAuthUtils.loginAndAuth();
    loggingUtils.installLogging();
    loggingUtils.waitForLoggingReady();
    cy.log('Before block Logging (no session) completed');
  }
});

Cypress.Commands.add('cleanupOtel', () => {
  cy.log('Cleanup OpenTelemetry');
  tracesUtils.cleanupOtel();
  cy.log('Cleanup OpenTelemetry completed');
});

Cypress.Commands.add('cleanupTempo', () => {
  cy.log('Cleanup Tempo');
  tracesUtils.cleanupTempo();
  cy.log('Cleanup Tempo completed');
});

Cypress.Commands.add('cleanupLoki', () => {
  cy.log('Cleanup Loki');
  loggingUtils.cleanupLoki();
  cy.log('Cleanup Loki completed');
});

Cypress.Commands.add('cleanupLogging', () => {
  cy.log('Cleanup Logging Operator');
  loggingUtils.cleanupLogging();
  cy.log('Cleanup Logging Operator completed');
});

Cypress.Commands.add('cleanupChainsawNamespaces', () => {
  cy.log('Cleanup Chainsaw namespaces');
  tracesUtils.cleanupChainsawNamespaces();
  cy.log('Cleanup Chainsaw namespaces completed');
});

Cypress.Commands.add('configureBase', () => {
  cy.log('Configure Base');
  tracesUtils.configureBase();
  cy.log('Configure Base completed');
});

Cypress.Commands.add('cleanupBase', () => {
  cy.log('Cleanup Base');
  tracesUtils.cleanupBase();
  cy.log('Cleanup Base completed');
});

Cypress.Commands.add('configureTracingApps', () => {
  cy.log('Configure Tracing Apps');
  tracesUtils.configureTracingApps();
  cy.log('Configure Tracing Apps completed');
});

Cypress.Commands.add('cleanupTracingApps', () => {
  cy.log('Cleanup Tracing Apps');
  tracesUtils.cleanupTracingApps();
  cy.log('Cleanup Tracing Apps completed');
});

Cypress.Commands.add('installDistributeTracingUIPlugin', () => {
  cy.log('Install Distributed Tracing UI Plugin');
  tracesUtils.installDistributeTracingUIPlugin();
  cy.log('Install Distributed Tracing UI Plugin completed');
});

Cypress.Commands.add('installLoggingUIPlugin', () => {
  cy.log('Install Logging UI Plugin');
  loggingUtils.installLoggingUIPlugin();
  cy.log('Install Logging UI Plugin completed');
});

Cypress.Commands.add('configureLoggingLoki', () => {
  cy.log('Configure Logging Loki');
  loggingUtils.configureLoggingLoki();
  cy.log('Configure Logging Loki completed');
});

Cypress.Commands.add('cleanupLoggingLoki', () => {
  cy.log('Cleanup Logging Loki');
  loggingUtils.cleanupLoggingLoki();
  cy.log('Cleanup Logging Loki completed');
});

Cypress.Commands.add('cleanupDistributeTracingUIPlugin', () => {
  cy.log('Cleanup Distributed Tracing UI Plugin');
  tracesUtils.cleanupDistributeTracingUIPlugin();
  cy.log('Cleanup Distributed Tracing UI Plugin completed');
});

Cypress.Commands.add('cleanupLoggingUIPlugin', () => {
  cy.log('Cleanup Logging UI Plugin');
  loggingUtils.cleanupLoggingUIPlugin();
  cy.log('Cleanup Logging UI Plugin completed');
});

Cypress.Commands.add('waitForDistributeTracingUIPluginReady', () => {
  cy.log('WaitFor Distributed Tracing UI Plugin Ready');
  tracesUtils.waitForDistributeTracingUIPluginReady();
  cy.log('WaitFor Distributed Tracing UI Plugin Ready completed');
});

Cypress.Commands.add('waitForLoggingUIPluginReady', () => {
  cy.log('WaitFor Logging UI Plugin Ready');
  loggingUtils.waitForLoggingUIPluginReady();
  cy.log('WaitFor Logging UI Plugin Ready completed');
});

Cypress.Commands.add('createTempoLokiThanosPersesGlobalDatasource', () => {
  cy.log('Create Tempo Loki Thanos Perses Global Datasource');
  persesUtils.createTempoLokiThanosPersesGlobalDatasource();
  cy.log('Create Tempo Loki Thanos Perses Global Datasource completed');
});

Cypress.Commands.add('cleanupTempoLokiThanosPersesGlobalDatasource', () => {
  cy.log('Cleanup Tempo Loki Thanos Perses Global Datasource');
  persesUtils.cleanupTempoLokiThanosPersesGlobalDatasource();
  cy.log('Cleanup Tempo Loki Thanos Perses Global Datasource completed');
});
