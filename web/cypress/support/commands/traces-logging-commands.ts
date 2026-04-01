/* eslint-disable @typescript-eslint/no-use-before-define */
import 'cypress-wait-until';
import { operatorHubPage } from '../../views/operator-hub-page';
import { nav } from '../../views/nav';
import { operatorAuthUtils } from './auth-commands';

export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      beforeBlockOtel(OTEL: { namespace: string; packageName: string });
      beforeBlockTempo(TEMPO: { namespace: string; packageName: string });
      configureBase();
      configureTracingApps();
      installDistributeTracingUIPlugin();
      waitForDistributeTracingUIPluginReady();

      beforeBlockLoki(LOKI: { namespace: string; packageName: string });
      beforeBlockLogging(CLO: { namespace: string; packageName: string });
      configureLoggingLoki();
      installLoggingUIPlugin();
      waitForLoggingUIPluginReady();

      cleanupOtel(OTEL: { namespace: string; packageName: string });
      cleanupTempo(TEMPO: { namespace: string; packageName: string });
      cleanupBase();
      cleanupTracingApps();
      cleanupTempoLokiThanosPersesGlobalDatasource();
      cleanupDistributeTracingUIPlugin();
      cleanupLoki(LOKI: { namespace: string; packageName: string });
      cleanupLogging(CLO: { namespace: string; packageName: string });
      cleanupLoggingLoki();
      cleanupLoggingUIPlugin();
      cleanupChainsawNamespaces();

      createTempoLokiThanosPersesGlobalDatasource();
    }
  }
}

const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

const useSession = String(Cypress.env('SESSION')).toLowerCase() === 'true';

const DTP = {
  namespace: Cypress.env('COO_NAMESPACE') || 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'distributed-tracing',
  },
};

const CLO = {
  namespace: Cypress.env('COO_NAMESPACE') || 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'logging',
  },
};
const checkForAlertRecursively = (attemptsLeft = 24) => {
  cy.get('body', { timeout: 10000 }).then(($body) => {
    if (
      $body.find('.pf-v5-c-alert, .pf-v6-c-alert').length > 0 &&
      $body.text().includes('Web console update is available')
    ) {
      cy.log('Web console update alert found');
      cy.get('.pf-v5-c-alert, .pf-v6-c-alert')
        .contains('Web console update is available')
        .should('exist');
    } else if (attemptsLeft > 0) {
      cy.log(
        `Alert not found, checking again in 5 seconds... (${attemptsLeft} attempts remaining)`,
      );
      cy.wait(5000);
      checkForAlertRecursively(attemptsLeft - 1);
    } else {
      cy.log('No web console update alert found after 2 minutes, navigating to traces page');
    }
  });
};

const tracesUtils = {
  installOtel(OTEL: { namespace: string; packageName: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping OpenTelemetry Operator installation.');
      return;
    }

    cy.log('Install Red Hat build of OpenTelemetry');
    operatorHubPage.installOperator(OTEL.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Operator installed successfully'),
      );
    });
  },

  waitForOtelReady(OTEL: { namespace: string }): void {
    cy.log('Check OpenTelemetry Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${OTEL.namespace} -o name --kubeconfig ${kubeconfig} ` +
              '| grep opentelemetry',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `OpenTelemetry operator pod not found in namespace ${OTEL.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${OTEL.namespace} -o name --kubeconfig ${kubeconfig} ` +
        '| grep opentelemetry',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found OpenTelemetry pod: ${podName}`);

        cy.exec(
          `oc wait --for=condition=Ready ${podName} -n ${OTEL.namespace} ` +
            `--timeout=120s --kubeconfig ${kubeconfig}`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`OpenTelemetry operator pod is now running in namespace: ${OTEL.namespace}`);
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

  cleanupOtel(OTEL: { namespace: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping OpenTelemetry Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Remove OpenTelemetry Operator');
    cy.executeAndDelete(`oc delete namespace ${OTEL.namespace} --kubeconfig ${kubeconfig}`);
  },

  installTempo(TEMPO: { namespace: string; packageName: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tempo Operator installation.');
      return;
    }

    cy.log('Install Tempo Operator');
    operatorHubPage.installOperator(TEMPO.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Operator installed successfully'),
      );
    });
  },

  waitForTempoReady(TEMPO: { namespace: string }): void {
    cy.log('Check Tempo Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${TEMPO.namespace} -o name --kubeconfig ${kubeconfig} ` +
              '| grep tempo',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `Tempo operator pod not found in namespace ${TEMPO.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${TEMPO.namespace} -o name --kubeconfig ${kubeconfig} ` + '| grep tempo',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found Tempo pod: ${podName}`);

        cy.exec(
          `oc wait --for=condition=Ready ${podName} -n ${TEMPO.namespace} ` +
            `--timeout=120s --kubeconfig ${kubeconfig}`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Tempo operator pod is now running in namespace: ${TEMPO.namespace}`);
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

  cleanupTempo(TEMPO: { namespace: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Tempo Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Tempo Operator namespace');
    cy.executeAndDelete(`oc delete namespace ${TEMPO.namespace} --kubeconfig ${kubeconfig}`);

    cy.log('Delete Tempo Operator resource');
    cy.exec(`oc delete operator tempo-product.${TEMPO.namespace} --kubeconfig ${kubeconfig}`, {
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
      cy.exec(
        `oc patch crd ${cr} -p '{"metadata":{"finalizers":[]}}' ` +
          `--type=merge --kubeconfig ${kubeconfig}`,
        { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: false },
      );
      cy.exec(
        `oc delete crd ${cr} --force --grace-period=0 ` +
          `--wait=false --ignore-not-found --kubeconfig ${kubeconfig}`,
        { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: false },
      );
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
    cy.exec(
      `oc apply -f ./cypress/fixtures/coo/traces/tracing-ui-plugin.yaml --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
    );
    cy.exec(
      // eslint-disable-next-line max-len
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=distributed-tracing -n ${
        DTP.namespace
      } --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: 80000,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(
        `Distributed Tracing Console plugin pod is now running in namespace: ${DTP.namespace}`,
      );
    });
    // Check for web console update alert for up to 2 minutes
    // (especially important for Hypershift clusters)
    cy.log('Checking for web console update alert for up to 2 minutes...');
    checkForAlertRecursively();
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
    cy.exec(
      `oc delete ${DTP.config.kind} ${DTP.config.name} --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
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
    const kc = Cypress.env('KUBECONFIG_PATH');
    const savedStatePath = 'cypress/fixtures/coo/traces/.original-monitoring-config.json';

    // Read and store the existing enableUserWorkload value, then patch
    cy.exec(
      `oc get configmap cluster-monitoring-config -n openshift-monitoring
      -o jsonpath='{.data["config.yaml"]}' --kubeconfig ${kc}`,
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
        cy.exec(
          `oc create configmap cluster-monitoring-config -n openshift-monitoring ` +
            `--from-literal=config.yaml='enableUserWorkload: true' --kubeconfig ${kc}`,
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
        cy.exec(
          `oc patch configmap cluster-monitoring-config -n openshift-monitoring ` +
            `--type merge -p '${patch}' --kubeconfig ${kc}`,
          { failOnNonZeroExit: false },
        );
      }
    });

    // Apply the rest of base.yaml (no longer contains cluster-monitoring-config)
    cy.exec(`oc apply -f ./cypress/fixtures/coo/traces/base.yaml --kubeconfig ${kc}`, {
      failOnNonZeroExit: false,
    });
  },

  cleanupBase(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Base cleanup.');
      return;
    }
    const kc = Cypress.env('KUBECONFIG_PATH');
    const savedStatePath = 'cypress/fixtures/coo/traces/.original-monitoring-config.json';

    // Restore cluster-monitoring-config if we saved its original state
    cy.exec(`test -f ${savedStatePath}`, {
      failOnNonZeroExit: false,
    }).then((testResult) => {
      if (testResult.code === 0) {
        cy.readFile(savedStatePath).then((original: { existed: boolean; configYaml: string }) => {
          if (!original.existed) {
            // ConfigMap didn't exist before we created it, so delete it
            cy.exec(
              `oc delete configmap cluster-monitoring-config
              -n openshift-monitoring --kubeconfig ${kc}`,
              { failOnNonZeroExit: false },
            );
          } else {
            // Restore original config.yaml value
            const patch = JSON.stringify({
              data: { 'config.yaml': original.configYaml },
            });
            cy.exec(
              `oc patch configmap cluster-monitoring-config -n openshift-monitoring ` +
                `--type merge -p '${patch}' --kubeconfig ${kc}`,
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
    cy.exec(`oc delete -f ./cypress/fixtures/coo/traces/base.yaml --kubeconfig ${kc}`, {
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
    cy.exec(
      `oc delete -f ./cypress/fixtures/coo/traces/tracing-apps.yaml --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
      { failOnNonZeroExit: false },
    );
  },
};

const loggingUtils = {
  installLoki(LOKI: { namespace: string; packageName: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Loki Operator installation.');
      return;
    }

    cy.log('Install Loki Operator');
    operatorHubPage.installOperator(LOKI.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Operator installed successfully'),
      );
    });
  },

  cleanupLoki(LOKI: { namespace: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Loki Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Loki Operator namespace');
    cy.executeAndDelete(`oc delete namespace ${LOKI.namespace} --kubeconfig ${kubeconfig}`);

    cy.log('Delete Loki Operator resource');
    cy.executeAndDelete(
      `oc delete operator loki-operator.${LOKI.namespace} --kubeconfig ${kubeconfig}`,
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

  installLogging(CLO: { namespace: string; packageName: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Operator installation.');
      return;
    }

    cy.log('Install Logging Operator');
    operatorHubPage.installOperator(CLO.packageName, 'redhat-operators');
    cy.get('.co-clusterserviceversion-install__heading', {
      timeout: installTimeoutMilliseconds,
    }).should(($el) => {
      const text = $el.text();
      expect(text).to.satisfy(
        (t: string) => t.includes('ready for use') || t.includes('Create initialization resource'),
      );
    });
  },

  cleanupLogging(CLO: { namespace: string }): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Operator cleanup.');
      return;
    }

    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.log('Delete Logging Operator namespace');
    cy.executeAndDelete(`oc delete namespace ${CLO.namespace} --kubeconfig ${kubeconfig}`);

    cy.log('Delete Logging Operator resource');
    cy.executeAndDelete(
      `oc delete operator cluster-logging.${CLO.namespace} --kubeconfig ${kubeconfig}`,
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

  waitForLokiReady(LOKI: { namespace: string }): void {
    cy.log('Check Loki Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${LOKI.namespace} -o name --kubeconfig ${kubeconfig} ` + '| grep loki',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `Loki operator pod not found in namespace ${LOKI.namespace}`,
      },
    );

    cy.exec(`oc get pods -n ${LOKI.namespace} -o name --kubeconfig ${kubeconfig} ` + '| grep loki')
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found Loki pod: ${podName}`);

        cy.exec(
          `oc wait --for=condition=Ready ${podName} -n ${LOKI.namespace} ` +
            `--timeout=120s --kubeconfig ${kubeconfig}`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Loki operator pod is now running in namespace: ${LOKI.namespace}`);
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

  waitForLoggingReady(CLO: { namespace: string }): void {
    cy.log('Check Logging Operator status');
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');

    cy.waitUntil(
      () =>
        cy
          .exec(
            `oc get pods -n ${CLO.namespace} -o name --kubeconfig ${kubeconfig} ` +
              '| grep logging',
            { failOnNonZeroExit: false },
          )
          .then((result) => result.code === 0 && result.stdout.trim().length > 0),
      {
        timeout: readyTimeoutMilliseconds,
        interval: 10000,
        errorMsg: `Logging operator pod not found in namespace ${CLO.namespace}`,
      },
    );

    cy.exec(
      `oc get pods -n ${CLO.namespace} -o name --kubeconfig ${kubeconfig} ` + '| grep logging',
    )
      .its('stdout')
      .then((podOutput) => {
        const podName = podOutput.trim().split('\n')[0];
        cy.log(`Found Logging pod: ${podName}`);

        cy.exec(
          `oc wait --for=condition=Ready ${podName} -n ${CLO.namespace} ` +
            `--timeout=120s --kubeconfig ${kubeconfig}`,
          { timeout: readyTimeoutMilliseconds, failOnNonZeroExit: true },
        ).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(`Logging operator pod is now running in namespace: ${CLO.namespace}`);
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
    cy.exec(
      `oc apply -f ./cypress/fixtures/coo/logging/logging-ui-plugin.yaml --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
    );
    cy.log('Install Logging UI Plugin completed');

    cy.exec(
      // eslint-disable-next-line max-len
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=logging -n ${
        CLO.namespace
      } --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: 80000,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Logging UI Plugin pod is now running in namespace: ${CLO.namespace}`);
    });
    // Check for web console update alert for up to 2 minutes
    // (especially important for Hypershift clusters)
    cy.log('Checking for web console update alert for up to 2 minutes...');
    checkForAlertRecursively();
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
    cy.exec(
      `oc delete ${CLO.config.kind} ${CLO.config.name} --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
      { failOnNonZeroExit: false },
    );
    cy.log('Cleanup Logging UI Plugin completed');
  },

  configureLoggingLoki(): void {
    cy.log('Configure Logging Loki');
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Logging Loki configuration.');
      return;
    }
    const kc = Cypress.env('KUBECONFIG_PATH');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/logging/base.yaml --kubeconfig ${kc}`, {
      failOnNonZeroExit: false,
    });
    cy.exec(`oc project openshift-logging --kubeconfig ${kc}`);
    cy.exec(`oc create sa collector -n openshift-logging --kubeconfig ${kc}`, {
      failOnNonZeroExit: false,
    });
    cy.exec(
      `oc adm policy add-cluster-role-to-user logging-collector-logs-writer ` +
        `-z collector --kubeconfig ${kc}`,
      { failOnNonZeroExit: false },
    );
    cy.exec(
      `oc adm policy add-cluster-role-to-user collect-application-logs ` +
        `-z collector --kubeconfig ${kc}`,
      { failOnNonZeroExit: false },
    );
    cy.exec(
      `oc adm policy add-cluster-role-to-user collect-audit-logs ` +
        `-z collector --kubeconfig ${kc}`,
      { failOnNonZeroExit: false },
    );
    cy.exec(
      `oc adm policy add-cluster-role-to-user collect-infrastructure-logs ` +
        `-z collector --kubeconfig ${kc}`,
      { failOnNonZeroExit: false },
    );

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
    cy.exec(
      `oc delete -f ./cypress/fixtures/coo/logging/base.yaml --kubeconfig ${Cypress.env(
        'KUBECONFIG_PATH',
      )}`,
      { failOnNonZeroExit: false },
    );
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
    const kc = Cypress.env('KUBECONFIG_PATH');
    cy.exec(
      `oc apply -f ./cypress/fixtures/perses/perses-global-datasources.yaml --kubeconfig ${kc}`,
      { failOnNonZeroExit: false },
    );
  },

  cleanupTempoLokiThanosPersesGlobalDatasource(): void {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log(
        'SKIP_COO_INSTALL is set. Skipping Tempo Loki Thanos Perses Global Datasource cleanup.',
      );
      return;
    }
    const kc = Cypress.env('KUBECONFIG_PATH');
    cy.exec(
      `oc delete -f ./cypress/fixtures/perses/perses-global-datasources.yaml --kubeconfig ${kc}`,
      { failOnNonZeroExit: false },
    );
  },
};

// ── Cypress commands ───────────────────────────────────────────────

Cypress.Commands.add('beforeBlockOtel', (OTEL: { namespace: string; packageName: string }) => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey('otel', OTEL);
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block OpenTelemetry (session)');
        cy.cleanupOtel(OTEL);
        operatorAuthUtils.loginAndAuthNoSession();
        tracesUtils.installOtel(OTEL);
        tracesUtils.waitForOtelReady(OTEL);
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
    cy.cleanupOtel(OTEL);
    operatorAuthUtils.loginAndAuth();
    tracesUtils.installOtel(OTEL);
    tracesUtils.waitForOtelReady(OTEL);
    cy.log('Before block OpenTelemetry (no session) completed');
  }
});

Cypress.Commands.add('beforeBlockTempo', (TEMPO: { namespace: string; packageName: string }) => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey('tempo', TEMPO);
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Tempo (session)');
        cy.cleanupTempoLokiThanosPersesGlobalDatasource();
        cy.cleanupBase();
        cy.cleanupTracingApps();
        cy.cleanupTempo(TEMPO);
        tracesUtils.cleanupChainsawNamespaces();
        operatorAuthUtils.loginAndAuthNoSession();
        tracesUtils.installTempo(TEMPO);
        tracesUtils.waitForTempoReady(TEMPO);
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
    cy.cleanupTempo(TEMPO);
    tracesUtils.cleanupChainsawNamespaces();
    operatorAuthUtils.loginAndAuth();
    tracesUtils.installTempo(TEMPO);
    tracesUtils.waitForTempoReady(TEMPO);
    cy.log('Before block Tempo (no session) completed');
  }
});

Cypress.Commands.add('beforeBlockLoki', (LOKI: { namespace: string; packageName: string }) => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey('loki', LOKI);
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Loki (session)');
        cy.cleanupLoggingLoki();
        cy.cleanupLoki(LOKI);
        operatorAuthUtils.loginAndAuthNoSession();
        loggingUtils.installLoki(LOKI);
        loggingUtils.waitForLokiReady(LOKI);
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
    cy.cleanupLoki(LOKI);
    operatorAuthUtils.loginAndAuth();
    loggingUtils.installLoki(LOKI);
    loggingUtils.waitForLokiReady(LOKI);
    cy.log('Before block Loki (no session) completed');
  }
});

Cypress.Commands.add('beforeBlockLogging', (CLO: { namespace: string; packageName: string }) => {
  if (useSession) {
    const sessionKey = operatorAuthUtils.generateTracesLoggingSessionKey('logging', CLO);
    cy.session(
      sessionKey,
      () => {
        cy.log('Before block Logging (session)');
        cy.cleanupLogging(CLO);
        cy.cleanupLoggingLoki();
        operatorAuthUtils.loginAndAuthNoSession();
        loggingUtils.installLogging(CLO);
        loggingUtils.waitForLoggingReady(CLO);
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
    cy.cleanupLogging(CLO);
    cy.cleanupLoggingLoki();
    operatorAuthUtils.loginAndAuth();
    loggingUtils.installLogging(CLO);
    loggingUtils.waitForLoggingReady(CLO);
    cy.log('Before block Logging (no session) completed');
  }
});

Cypress.Commands.add('cleanupOtel', (OTEL: { namespace: string; packageName: string }) => {
  cy.log('Cleanup OpenTelemetry');
  tracesUtils.cleanupOtel(OTEL);
  cy.log('Cleanup OpenTelemetry completed');
});

Cypress.Commands.add('cleanupTempo', (TEMPO: { namespace: string; packageName: string }) => {
  cy.log('Cleanup Tempo');
  tracesUtils.cleanupTempo(TEMPO);
  cy.log('Cleanup Tempo completed');
});

Cypress.Commands.add('cleanupLoki', (LOKI: { namespace: string; packageName: string }) => {
  cy.log('Cleanup Loki');
  loggingUtils.cleanupLoki(LOKI);
  cy.log('Cleanup Loki completed');
});

Cypress.Commands.add('cleanupLogging', (CLO: { namespace: string; packageName: string }) => {
  cy.log('Cleanup Logging Operator');
  loggingUtils.cleanupLogging(CLO);
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
