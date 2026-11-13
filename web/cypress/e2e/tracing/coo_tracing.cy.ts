// Distributed tracing e2e suite ported from openshift/distributed-tracing-console-plugin
// tests/e2e/dt-plugin-tests.cy.ts at a18f314ec7e2a7fd146ccf86c83f4f3edf552270.
// It still targets the LEGACY COO-deployed DistributedTracing UIPlugin (`distributed-tracing`
// deployment, image overridable with DT_CONSOLE_IMAGE), not the merged `tracing` feature of
// monitoring-console-plugin. At activation the setup moves to the monitoring UIPlugin
// (monitoring-console-plugin) with the `tracing` feature; the UI and its selectors stay the same.
// The TLS cert-rotation and TLS-profile tests exercise the legacy plugin pod's server and must
// then be retargeted to the monitoring-console-plugin pod or dropped.
// Prerequisites and env vars: cypress/README.md, "Distributed tracing (legacy plugin) e2e".
import { OPENTELEMETRY_OPERATOR as OTEL, TEMPO_OPERATOR as TEMPO } from '../../support/operators';
import { OLS_SELECTORS, olsHelpers } from '../../views/tracing-lightspeed';
import { tracingOperatorHubPage } from '../../views/tracing-operator-hub-page';

// Application errors the DT suite ignored in its support file (e2e.js); registered in this spec
// so they do not widen the global handler in cypress/support/index.ts.
Cypress.on('uncaught:exception', (err) => {
  // Return false to prevent the test from failing on uncaught exceptions
  // that might be caused by the application's React state management
  if (
    err.message.includes('e is not a function') ||
    err.message.includes('Cannot read prop') ||
    err.message.includes('undefined is not a function') ||
    err.message.includes('Cannot read properties of undefined') ||
    err.message.includes('before initialization') ||
    // Console plugin module loading errors (e.g. Lightspeed OverviewDetail) are
    // transient and should not fail our tests — the plugin itself is tested separately.
    err.message.includes('Failed to load module')
  ) {
    console.log('Caught application error:', err.message);
    return false;
  }
  // Let other exceptions fail the test unless another handler ignores them
});

// Set constants for the operators that need to be installed for tests.
const DTP = {
  namespace: Cypress.env('COO_NAMESPACE') || 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'distributed-tracing',
  },
};

const LIGHTSPEED = {
  namespace: 'openshift-lightspeed',
  packageName: 'lightspeed-operator',
  operatorName: 'Lightspeed Operator',
};

// Lightspeed is not available on every OCP version. When the Lightspeed test is excluded
// with --env grep=-Lightspeed (CYPRESS_SKIP_TESTS in CI), also skip its operator install and setup.
const SKIP_LIGHTSPEED = String(Cypress.env('grep') || '').includes('-Lightspeed');

// The tests share state (the second test creates the Tempo instances the later tests use), so
// isolation is off for this suite only; pageLoadTimeout keeps DT's value.
describe(
  'tracing-uiplugin',
  {
    tags: ['@tracing', '@tracing-legacy', '@coo'],
    testIsolation: false,
    pageLoadTimeout: 120000,
  },
  () => {
    before(() => {
      // Always clean up TLS profile test leftovers first, in case a previous run was interrupted
      cy.log(
        'Pre-flight TLS cleanup: restore operator to 1 replica and remove tls-scanner resources',
      );
      cy.exec(
        `oc scale deployment observability-operator -n ${DTP.namespace} --replicas=1 --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete pod tls-scanner -n ${DTP.namespace} --force --grace-period=0 --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete clusterrolebinding tls-scanner-pods-reader-dt-plugin --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete clusterrole tls-scanner-pods-reader-dt-plugin --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete scc tls-scanner-scc-dt-plugin --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete sa tls-scanner -n ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; echo "Pre-flight TLS cleanup done"`,
        { failOnNonZeroExit: false, timeout: 60000 },
      );

      // Cleanup any existing resources from interrupted tests
      cy.log('Cleanup any existing resources from previous interrupted tests');
      if (Cypress.env('SKIP_COO_INSTALL')) {
        cy.log('Delete Lightspeed OLSConfig if exists.');
        cy.executeAndDelete(
          `oc delete olsconfig cluster -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Lightspeed secret if exists.');
        cy.executeAndDelete(
          `oc delete secret openai-token -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Ensure UIPlugin exists — create if missing, leave in place if already running.');
        // Avoid deleting and recreating the UIPlugin: the delete/recreate cycle causes the
        // console browser cache to have a stale plugin URL that returns 404, triggering
        // "__load_plugin_entry__ is not defined" during login. Instead, idempotently apply
        // the UIPlugin so it is always present before the test suite starts.
        cy.exec(
          `echo '{"apiVersion":"observability.openshift.io/v1alpha1","kind":"UIPlugin","metadata":{"name":"${DTP.config.name}"},"spec":{"type":"DistributedTracing"}}' | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          { failOnNonZeroExit: false, timeout: 30000 },
        );
        // Wait for COO to reconcile and the plugin pod to become Ready before visiting the console.
        cy.exec(
          `for i in $(seq 1 24); do oc get deployment distributed-tracing -n ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} >/dev/null 2>&1 && break || sleep 5; done; oc rollout status deployment/distributed-tracing -n ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --timeout=120s`,
          { failOnNonZeroExit: false, timeout: 180000 },
        );

        cy.log('Delete Chainsaw namespaces if they exist.');
        cy.exec(
          `for ns in $(oc get projects -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} | grep "chainsaw-" | sed 's|project.project.openshift.io/||'); do oc get opentelemetrycollectors.opentelemetry.io,tempostacks.tempo.grafana.com,tempomonolithics.tempo.grafana.com,pvc -n $ns -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null | xargs --no-run-if-empty -I {} oc patch {} -n $ns --type merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true; oc delete project $ns --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || true; done`,
          {
            timeout: 180000,
            failOnNonZeroExit: false,
          },
        );

        // Verify Tempo Operator is installed; install via CLI if missing.
        // This prevents cascade failures when the after() hook from a previous run failed to
        // reinstall it.
        cy.log('Verify Tempo Operator is installed, install via CLI if missing');
        cy.exec(
          `oc get csv -l operators.coreos.com/tempo-product.${TEMPO.namespace} -n ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "not-found"`,
          { failOnNonZeroExit: false },
        ).then((result) => {
          const phase = result.stdout.trim();
          cy.log(`Tempo Operator CSV phase: '${phase}'`);
          if (phase !== 'Succeeded') {
            cy.log(`Tempo Operator not ready (phase: '${phase}'), installing via CLI...`);
            cy.exec(
              `oc create namespace ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `oc label namespace ${TEMPO.namespace} openshift.io/cluster-monitoring=true --overwrite --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `echo '{"apiVersion":"operators.coreos.com/v1","kind":"OperatorGroup","metadata":{"name":"${TEMPO.namespace}","namespace":"${TEMPO.namespace}"},"spec":{"upgradeStrategy":"Default"}}' | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `echo '{"apiVersion":"operators.coreos.com/v1alpha1","kind":"Subscription","metadata":{"name":"tempo-product","namespace":"${TEMPO.namespace}"},"spec":{"channel":"stable","name":"tempo-product","source":"redhat-operators","sourceNamespace":"openshift-marketplace","installPlanApproval":"Automatic"}}' | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `for i in $(seq 1 90); do PHASE=$(oc get csv -l operators.coreos.com/tempo-product.${TEMPO.namespace} -n ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} -o jsonpath='{.items[0].status.phase}' 2>/dev/null); echo "CSV phase: $PHASE (attempt $i/90)"; if [ "$PHASE" = "Succeeded" ]; then exit 0; fi; sleep 5; done; echo "Tempo Operator did not reach Succeeded in 7.5 minutes"; exit 1`,
              { timeout: 540000, failOnNonZeroExit: false },
            );
            cy.log('Tempo Operator installation completed');
          }
        });

        // Only remove cluster-admin role if provider is not kube:admin
        if (Cypress.env('LOGIN_IDP') !== 'kube:admin') {
          cy.log('Remove cluster-admin role from user if exists.');
          cy.executeAndDelete(
            `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          );
        }
      } else {
        cy.log('Delete Lightspeed OLSConfig if exists.');
        cy.executeAndDelete(
          `oc delete olsconfig cluster -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Lightspeed secret if exists.');
        cy.executeAndDelete(
          `oc delete secret openai-token -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Distributed Tracing UI Plugin instance if exists.');
        cy.executeAndDelete(
          `oc delete ${DTP.config.kind} ${DTP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Chainsaw namespaces if they exist.');
        cy.exec(
          `for ns in $(oc get projects -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} | grep "chainsaw-" | sed 's|project.project.openshift.io/||'); do oc get opentelemetrycollectors.opentelemetry.io,tempostacks.tempo.grafana.com,tempomonolithics.tempo.grafana.com,pvc -n $ns -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null | xargs --no-run-if-empty -I {} oc patch {} -n $ns --type merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true; oc delete project $ns --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || true; done`,
          {
            timeout: 180000,
            failOnNonZeroExit: false,
          },
        );

        cy.log('Remove Cluster Observability Operator if exists');
        cy.executeAndDelete(
          `oc delete namespace ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Remove OpenTelemetry Operator if exists');
        cy.executeAndDelete(
          `oc delete namespace ${OTEL.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Remove Tempo Operator if exists');
        cy.executeAndDelete(
          `oc delete namespace ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Remove Lightspeed Operator if exists');
        cy.executeAndDelete(
          `oc delete namespace ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        // Only remove cluster-admin role if provider is not kube:admin
        if (Cypress.env('LOGIN_IDP') !== 'kube:admin') {
          cy.log('Remove cluster-admin role from user if exists.');
          cy.executeAndDelete(
            `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          );
        }
      }
      // Only add cluster-admin role if provider is not kube:admin
      if (Cypress.env('LOGIN_IDP') !== 'kube:admin') {
        cy.adminCLI(
          `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
        );
      }
      // Simplified login without OAuth URL complexity
      cy.dtLogin(
        Cypress.env('LOGIN_IDP'),
        Cypress.env('LOGIN_USERNAME'),
        Cypress.env('LOGIN_PASSWORD'),
      );

      if (Cypress.env('SKIP_COO_INSTALL')) {
        cy.log('SKIP_COO_INSTALL is set. Skipping Cluster Observability Operator installation.');
      } else if (Cypress.env('COO_UI_INSTALL')) {
        cy.log(
          'COO_UI_INSTALL is set. COO, Tempo, OpenTelemetry and Lightspeed operators will be installed from redhat-operators catalog source',
        );
        cy.log('Install Cluster Observability Operator');
        // cypress.config.ts always sets COO_NAMESPACE, so compare with its default: DT took this
        // path only for an explicitly set namespace.
        if (DTP.namespace !== 'openshift-cluster-observability-operator') {
          cy.log(`Using custom namespace: ${Cypress.env('COO_NAMESPACE')}`);
          tracingOperatorHubPage.installOperator(
            DTP.packageName,
            'redhat-operators',
            Cypress.env('COO_NAMESPACE'),
          );
        } else {
          cy.log('Using recommended namespace installation');
          tracingOperatorHubPage.installOperator(DTP.packageName, 'redhat-operators');
        }
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        cy.log('Install OpenTelemetry Operator');
        tracingOperatorHubPage.installOperator(OTEL.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        cy.log('Install Tempo Operator');
        tracingOperatorHubPage.installOperator(TEMPO.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        if (SKIP_LIGHTSPEED) {
          cy.log('Lightspeed tests are excluded. Skipping Lightspeed Operator installation.');
        } else {
          cy.log('Install Lightspeed Operator');
          tracingOperatorHubPage.installOperator(LIGHTSPEED.packageName, 'redhat-operators');
          cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
            ($el) => {
              const text = $el.text();
              expect(text).to.satisfy(
                (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
              );
            },
          );
        }
      } else if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')) {
        cy.log(
          'KONFLUX_COO_BUNDLE_IMAGE is set. COO operator will be installed from Konflux bundle. Tempo, OpenTelemetry and Lightspeed operators will be installed from redhat-operators catalog source',
        );
        cy.log('Install Cluster Observability Operator');
        cy.exec(
          `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
        );
        cy.exec(
          `oc create namespace ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );
        cy.exec(
          `oc label namespaces ${DTP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );
        cy.exec(
          `operator-sdk run bundle --timeout=10m --namespace ${DTP.namespace} ${Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
          { timeout: 6 * 60 * 1000 },
        );
        cy.log('Install OpenTelemetry Operator');
        tracingOperatorHubPage.installOperator(OTEL.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        cy.log('Install Tempo Operator');
        tracingOperatorHubPage.installOperator(TEMPO.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        if (SKIP_LIGHTSPEED) {
          cy.log('Lightspeed tests are excluded. Skipping Lightspeed Operator installation.');
        } else {
          cy.log('Install Lightspeed Operator');
          tracingOperatorHubPage.installOperator(LIGHTSPEED.packageName, 'redhat-operators');
          cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
            ($el) => {
              const text = $el.text();
              expect(text).to.satisfy(
                (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
              );
            },
          );
        }
      } else if (Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
        cy.log(
          'CUSTOM_COO_BUNDLE_IMAGE is set. COO operator will be installed from custom built bundle. Tempo, OpenTelemetry and Lightspeed operators will be installed from redhat-operators catalog source',
        );
        cy.log('Install Cluster Observability Operator');
        cy.exec(
          `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
        );
        cy.exec(
          `oc create namespace ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );
        cy.exec(
          `oc label namespaces ${DTP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );
        cy.exec(
          `operator-sdk run bundle --timeout=10m --namespace ${DTP.namespace} ${Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
          { timeout: 6 * 60 * 1000 },
        );
        cy.log('Install OpenTelemetry Operator');
        tracingOperatorHubPage.installOperator(OTEL.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        cy.log('Install Tempo Operator');
        tracingOperatorHubPage.installOperator(TEMPO.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          ($el) => {
            const text = $el.text();
            expect(text).to.satisfy(
              (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
            );
          },
        );
        if (SKIP_LIGHTSPEED) {
          cy.log('Lightspeed tests are excluded. Skipping Lightspeed Operator installation.');
        } else {
          cy.log('Install Lightspeed Operator');
          tracingOperatorHubPage.installOperator(LIGHTSPEED.packageName, 'redhat-operators');
          cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
            ($el) => {
              const text = $el.text();
              expect(text).to.satisfy(
                (t) => t.includes('ready for use') || t.includes('Operator installed successfully'),
              );
            },
          );
        }
      } else {
        throw new Error(
          'No CYPRESS env set for operator installation, check the README for more details.',
        );
      }

      cy.log('Set Distributed Tracing Console Plugin image in operator CSV');
      if (Cypress.env('DT_CONSOLE_IMAGE')) {
        cy.log('DT_CONSOLE_IMAGE is set. the image will be patched in COO operator CSV');
        cy.exec('./cypress/fixtures/coo/traces/update-dt-plugin-image.sh', {
          env: {
            DT_CONSOLE_IMAGE: Cypress.env('DT_CONSOLE_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            DTP_NAMESPACE: `${DTP.namespace}`,
          },
          timeout: 120000,
          failOnNonZeroExit: true,
        }).then((result) => {
          expect(result.code).to.eq(0);
          cy.log(
            'COO CSV updated successfully with Distributed Tracing Console Plugin image: ' +
              `${result.stdout}`,
          );
        });
      } else {
        cy.log('DT_CONSOLE_IMAGE is NOT set. Skipping patching the image in COO operator CSV.');
      }

      if (SKIP_LIGHTSPEED) {
        cy.log('Lightspeed tests are excluded. Skipping Lightspeed setup.');
      } else {
        cy.log('Set Lightspeed Console Plugin image in operator CSV');
        if (Cypress.env('LIGHTSPEED_CONSOLE_IMAGE')) {
          cy.log(
            'LIGHTSPEED_CONSOLE_IMAGE is set. the image will be patched in Lightspeed operator CSV',
          );
          cy.exec('./cypress/fixtures/coo/traces/update-lightspeed-plugin-image.sh', {
            env: {
              LIGHTSPEED_CONSOLE_IMAGE: Cypress.env('LIGHTSPEED_CONSOLE_IMAGE'),
              KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
              LIGHTSPEED_NAMESPACE: `${LIGHTSPEED.namespace}`,
            },
            timeout: 240000,
            failOnNonZeroExit: true,
          }).then((result) => {
            expect(result.code).to.eq(0);
            cy.log(
              'Lightspeed CSV updated successfully with Lightspeed Console Plugin image: ' +
                `${result.stdout}`,
            );
          });
        } else {
          cy.log(
            'LIGHTSPEED_CONSOLE_IMAGE is NOT set. Skipping patching the image in Lightspeed operator CSV.',
          );
        }

        cy.log('Run Lightspeed Chainsaw test to setup OLSConfig and credentials');
        // Written as JSON (valid YAML) without a shell and with logging off, so the token
        // never reaches the Cypress command log, videos or screenshots.
        cy.writeFile(
          '/tmp/chainsaw-lightspeed-values.yaml',
          {
            LIGHTSPEED_PROVIDER_URL: Cypress.env('LIGHTSPEED_PROVIDER_URL'),
            LIGHTSPEED_PROVIDER_TOKEN: Cypress.env('LIGHTSPEED_PROVIDER_TOKEN'),
          },
          { log: false },
        );
        cy.runChainsawTest(
          './cypress/fixtures/coo/traces/lightspeed',
          'Lightspeed OLSConfig and credentials setup',
          {
            timeout: 1800000,
            extraArgs: '--values /tmp/chainsaw-lightspeed-values.yaml',
          },
        );

        cy.log('Wait for Lightspeed popover to open by default and close it');
        cy.visit('/');
        cy.dismissWelcomeModal();
        olsHelpers.waitForPopoverAndClose();
      }

      cy.log('Create Distributed Tracing UI Plugin instance.');
      cy.exec(
        `oc apply -f ./cypress/fixtures/coo/traces/tracing-ui-plugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `for i in $(seq 1 36); do POD=$(oc get pods --selector=app.kubernetes.io/instance=distributed-tracing -n ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} -o name 2>/dev/null | head -1); if [ -n "$POD" ]; then oc wait --for=condition=Ready $POD -n ${DTP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} && exit 0; fi; echo "Pod not found yet, attempt $i/36, waiting 5s..."; sleep 5; done; echo "Pod not found after 3 minutes"; exit 1`,
        {
          timeout: 240000,
          failOnNonZeroExit: true,
        },
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(
          `Distributed Tracing Console plugin pod is now running in namespace: ${DTP.namespace}`,
        );
      });
      // Check for web console update alert for up to 2 minutes (especially important for
      // Hypershift clusters)
      cy.log('Checking for web console update alert for up to 2 minutes...');

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
              'Alert not found, checking again in 5 seconds... ' +
                `(${attemptsLeft} attempts remaining)`,
            );
            cy.wait(5000);
            checkForAlertRecursively(attemptsLeft - 1);
          } else {
            cy.log('No web console update alert found after 2 minutes, navigating to traces page');
            cy.visit('/observe/traces');
            cy.url().should('include', '/observe/traces');
            cy.dismissWelcomeModal();
            cy.get('body').should('be.visible');
            // Wait for the page to fully render
            cy.wait(3000);
          }
        });
      };

      checkForAlertRecursively();
    });

    after(() => {
      // Always clean up TLS profile test leftovers in case the TLS profile test failed mid-way.
      // This ensures the operator is running and tls-scanner is gone before other cleanup proceeds.
      cy.log(
        'TLS profile cleanup: scale operator back to 1 replica and remove tls-scanner resources',
      );
      cy.exec(
        `oc scale deployment observability-operator -n ${DTP.namespace} --replicas=1 --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete pod tls-scanner -n ${DTP.namespace} --force --grace-period=0 --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete clusterrolebinding tls-scanner-pods-reader-dt-plugin --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete clusterrole tls-scanner-pods-reader-dt-plugin --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete scc tls-scanner-scc-dt-plugin --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; oc delete sa tls-scanner -n ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; echo "TLS cleanup done"`,
        { failOnNonZeroExit: false, timeout: 60000 },
      );

      if (Cypress.env('SKIP_COO_INSTALL')) {
        // Reinstall Tempo via CLI if the Installation test deleted it. CLI-based reinstall is
        // used here because the console may be in a bad state after a TLS profile test failure.
        cy.log('Reinstall Tempo Operator via CLI if it was deleted by the Installation test');
        cy.exec(
          `oc get namespace ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          { failOnNonZeroExit: false },
        ).then((result) => {
          if (result.code !== 0) {
            cy.log('Tempo Operator namespace not found, reinstalling via CLI...');
            cy.exec(
              `oc create namespace ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `oc label namespace ${TEMPO.namespace} openshift.io/cluster-monitoring=true --overwrite --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `echo '{"apiVersion":"operators.coreos.com/v1","kind":"OperatorGroup","metadata":{"name":"${TEMPO.namespace}","namespace":"${TEMPO.namespace}"},"spec":{"upgradeStrategy":"Default"}}' | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `echo '{"apiVersion":"operators.coreos.com/v1alpha1","kind":"Subscription","metadata":{"name":"tempo-product","namespace":"${TEMPO.namespace}"},"spec":{"channel":"stable","name":"tempo-product","source":"redhat-operators","sourceNamespace":"openshift-marketplace","installPlanApproval":"Automatic"}}' | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
              { failOnNonZeroExit: false },
            );
            cy.exec(
              `for i in $(seq 1 90); do PHASE=$(oc get csv -l operators.coreos.com/tempo-product.${TEMPO.namespace} -n ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} -o jsonpath='{.items[0].status.phase}' 2>/dev/null); echo "CSV phase: $PHASE (attempt $i/90)"; if [ "$PHASE" = "Succeeded" ]; then exit 0; fi; sleep 5; done; echo "Tempo Operator CSV did not reach Succeeded in 7.5 minutes"; exit 1`,
              { timeout: 540000, failOnNonZeroExit: false },
            );
            cy.log('Tempo Operator reinstalled successfully via CLI');
          } else {
            cy.log('Tempo Operator namespace exists, skipping reinstall');
          }
        });

        cy.log('Delete Lightspeed OLSConfig.');
        cy.executeAndDelete(
          `oc delete olsconfig cluster -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Lightspeed secret.');
        cy.executeAndDelete(
          `oc delete secret openai-token -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Distributed Tracing UI Plugin instance.');
        cy.executeAndDelete(
          `oc delete ${DTP.config.kind} ${DTP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Chainsaw namespaces.');
        cy.exec(
          `for ns in $(oc get projects -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} | grep "chainsaw-" | sed 's|project.project.openshift.io/||'); do oc get opentelemetrycollectors.opentelemetry.io,tempostacks.tempo.grafana.com,tempomonolithics.tempo.grafana.com,pvc -n $ns -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null | xargs --no-run-if-empty -I {} oc patch {} -n $ns --type merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true; oc delete project $ns --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || true; done`,
          {
            timeout: 300000,
            failOnNonZeroExit: false,
          },
        );

        // Only remove cluster-admin role if provider is not kube:admin
        if (Cypress.env('LOGIN_IDP') !== 'kube:admin') {
          cy.log('Remove cluster-admin role from user.');
          cy.executeAndDelete(
            `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          );
        }
      } else {
        cy.log('Delete Lightspeed OLSConfig.');
        cy.executeAndDelete(
          `oc delete olsconfig cluster -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Lightspeed secret.');
        cy.executeAndDelete(
          `oc delete secret openai-token -n ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Distributed Tracing UI Plugin instance.');
        cy.executeAndDelete(
          `oc delete ${DTP.config.kind} ${DTP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Delete Chainsaw namespaces.');
        cy.exec(
          `for ns in $(oc get projects -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} | grep "chainsaw-" | sed 's|project.project.openshift.io/||'); do oc get opentelemetrycollectors.opentelemetry.io,tempostacks.tempo.grafana.com,tempomonolithics.tempo.grafana.com,pvc -n $ns -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null | xargs --no-run-if-empty -I {} oc patch {} -n $ns --type merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true; oc delete project $ns --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || true; done`,
          {
            timeout: 300000,
            failOnNonZeroExit: false,
          },
        );

        cy.log('Remove Cluster Observability Operator');
        cy.executeAndDelete(
          `oc delete namespace ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Remove OpenTelemetry Operator');
        cy.executeAndDelete(
          `oc delete namespace ${OTEL.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Remove Tempo Operator');
        cy.executeAndDelete(
          `oc delete namespace ${TEMPO.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        cy.log('Remove Lightspeed Operator');
        cy.executeAndDelete(
          `oc delete namespace ${LIGHTSPEED.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );

        // Only remove cluster-admin role if provider is not kube:admin
        if (Cypress.env('LOGIN_IDP') !== 'kube:admin') {
          cy.log('Remove cluster-admin role from user.');
          cy.executeAndDelete(
            `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          );
        }
      }
    });

    // Tests start from here.

    it('[Capability:UIPlugin][Capability:EmptyState] Test Distributed Tracing UI plugin page without any Tempo instances', () => {
      cy.log('Navigate to the observe/traces page');
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('body').should('be.visible');
      // Wait a bit for the page to fully render
      cy.wait(3000);

      cy.log('Assert that the Traces page shows the empty state.');
      cy.pfEmptyState().within(() => {
        cy.get('h1, h2, h3, h4, h5, h6').should('contain.text', 'No Tempo instances yet');
      });

      cy.log('Assert that the View documentation button is visible.');
      cy.pfButton('View documentation').should('be.visible').and('have.text', 'View documentation');

      cy.log('Assert create a tempo instance toggle visibility and text.');
      cy.pfMenuToggle('Create a Tempo instance').should('be.visible');

      cy.log('Click the toggle to show creation options.');
      cy.pfMenuToggle('Create a Tempo instance').click();

      cy.log('Assert dropdown items for Tempo instance creation are visible.');
      cy.pfMenuItem('Create a TempoStack instance')
        .should('be.visible')
        .and('have.text', 'Create a TempoStack instance');

      cy.pfMenuItem('Create a TempoMonolithic instance')
        .should('be.visible')
        .and('have.text', 'Create a TempoMonolithic instance');
    });

    it('[Capability:UIPlugin][Capability:TraceVisualization][Capability:SpanLinks][Capability:RBAC] Test Distributed Tracing UI plugin with Tempo instances and verify traces, span links using user having cluster-admin role', function () {
      cy.log('Create TempoStack and TempoMonolithic instances');
      cy.runChainsawTest(
        ['multitenancy-rbac', 'monolithic-multitenancy-rbac'],
        'Create TempoStack and TempoMonolithic instances',
        { timeout: 1200000 },
      );

      cy.log('Navigate to the /observe/traces page');
      // Force a clean navigation after the long chainsaw exec to handle any console auto-reloads
      cy.reload();
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      // Wait for the Tempo instance typeahead to confirm the page is fully loaded
      cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 30000 }).should('exist');
      cy.log('Assert traces in TempoStack instance.');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 15 minutes').click();
      cy.pfMenuToggle('Service Name').click();
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem('http-rbac-1');
      cy.pfCheckMenuItem('http-rbac-2');
      cy.pfCheckMenuItem('grpc-rbac-1');
      cy.pfCheckMenuItem('grpc-rbac-2');
      cy.muiFirstTraceLink().click();
      // Wait for trace detail page to fully render span bars before clicking
      cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 1);
      cy.findByTestId('span-duration-bar').eq(1).click();
      // Wait for attributes panel to load
      cy.get('.MuiListItemText-root', { timeout: 10000 }).should('be.visible');
      cy.muiTraceAttributes(
        {
          'network.peer.address': { value: ['1.2.3.4', '127.0.0.1'] },
          'peer.service': {
            value: (text) => ['telemetrygen-server', 'telemetrygen-client'].includes(text),
          },
          'k8s.container.name': { value: 'telemetrygen', optional: true },
          'k8s.namespace.name': {
            value: (text) =>
              [
                'chainsaw-test-rbac-1',
                'chainsaw-test-rbac-2',
                'chainsaw-mono-rbac-1',
                'chainsaw-mono-rbac-2',
              ].includes(text),
            optional: true,
          },
          'service.name': {
            value: (text) =>
              ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2'].includes(text),
          },
        },
        'TempoStack',
      );
      cy.log('Click on the Links tab');
      cy.get('button.MuiTab-root').contains('Links').click();
      cy.log('Verify link details are present');
      // Verify first link (index 0)
      cy.muiTraceAttribute('link.index', '0', false, 'Links');
      cy.muiTraceAttribute('link.type', 'random', false, 'Links');
      // Verify trace ID and span ID have valid format for first link (they will be different
      // each time)
      cy.contains('.MuiTypography-h5', 'trace ID')
        .first()
        .next('.MuiTypography-body1')
        .invoke('text')
        .then((traceId) => {
          cy.log(`First link trace ID: ${traceId.trim()}`);
          expect(traceId.trim()).to.match(/^[A-Fa-f0-9]{32}$/);
        });
      cy.contains('.MuiTypography-h5', 'span ID')
        .first()
        .next('.MuiTypography-body1')
        .invoke('text')
        .then((spanId) => {
          cy.log(`First link span ID: ${spanId.trim()}`);
          expect(spanId.trim()).to.match(/^[A-Fa-f0-9]{16}$/);
        });
      cy.log('Click on the first trace ID link to navigate to that trace');
      cy.contains('.MuiTypography-h5', 'trace ID')
        .first()
        .next('.MuiTypography-body1')
        .invoke('text')
        .then((traceId) => {
          const cleanTraceId = traceId.trim();
          cy.get('a.MuiLink-root[href*="/observe/traces/"]').first().click();

          cy.log('Verify URL contains the correct trace ID');
          cy.url().should('include', `/observe/traces/${cleanTraceId}`);
          cy.log(`✓ Successfully navigated to trace: ${cleanTraceId}`);
        });
      cy.log('Verify navigation by checking trace attributes');
      // Wait for trace detail page to fully render span bars after navigation
      cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 1);
      cy.findByTestId('span-duration-bar').eq(1).click();
      // Switch to the Attributes tab if tab bar is present, otherwise attributes are shown inline
      cy.get('body').then(($body) => {
        if ($body.find('button.MuiTab-root:contains("Attributes")').length > 0) {
          cy.get('button.MuiTab-root').contains('Attributes').click();
        }
      });
      // Wait for attributes to load
      cy.get('.MuiListItemText-root, .MuiTypography-h5', { timeout: 10000 }).should('be.visible');
      cy.muiTraceAttributes(
        {
          'network.peer.address': { value: ['1.2.3.4', '127.0.0.1'] },
          'peer.service': {
            value: (text) => ['telemetrygen-server', 'telemetrygen-client'].includes(text),
          },
          'k8s.container.name': { value: 'telemetrygen', optional: true },
          'k8s.namespace.name': {
            value: (text) =>
              [
                'chainsaw-test-rbac-1',
                'chainsaw-test-rbac-2',
                'chainsaw-mono-rbac-1',
                'chainsaw-mono-rbac-2',
              ].includes(text),
            optional: true,
          },
          'service.name': {
            value: (text) =>
              ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2'].includes(text),
          },
        },
        'TempoStack',
      );

      cy.log('Rerun the steps and select span ID from links');
      cy.pfBreadcrumb('Traces').click();
      cy.pfCloseButtonIfExists('Close chip group');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();
      cy.pfMenuToggle('Service Name').click();
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem('http-rbac-1');
      cy.pfCheckMenuItem('http-rbac-2');
      cy.pfCheckMenuItem('grpc-rbac-1');
      cy.pfCheckMenuItem('grpc-rbac-2');
      cy.muiFirstTraceLink().click();
      // Wait for trace detail page to fully render span bars before clicking
      cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 1);
      cy.findByTestId('span-duration-bar').eq(1).click();
      cy.log('Click on the Links tab again');
      cy.get('button.MuiTab-root').contains('Links').click();
      cy.log('Click on the first span ID link to navigate to that span');
      cy.contains('.MuiTypography-h5', 'trace ID')
        .first()
        .next('.MuiTypography-body1')
        .invoke('text')
        .then((traceId) => {
          const cleanTraceId = traceId.trim();
          cy.contains('.MuiTypography-h5', 'span ID')
            .first()
            .next('.MuiTypography-body1')
            .invoke('text')
            .then((spanId) => {
              const cleanSpanId = spanId.trim();
              cy.contains('.MuiTypography-h5', 'span ID')
                .first()
                .next('.MuiTypography-body1')
                .find('a')
                .first()
                .click();

              cy.log('Verify URL contains the correct trace ID and span ID');
              cy.url().should('include', `/observe/traces/${cleanTraceId}`);
              cy.url().should('include', `selectSpan=${cleanSpanId}`);
              cy.log(
                `✓ Successfully navigated to trace: ${cleanTraceId} ` +
                  `with selected span: ${cleanSpanId}`,
              );
            });
        });
      cy.log('Verify navigation by checking trace attributes');
      // Wait for trace detail page to fully render span bars after navigation
      cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 1);
      cy.findByTestId('span-duration-bar').eq(1).click();
      // Switch to the Attributes tab if tab bar is present, otherwise attributes are shown inline
      cy.get('body').then(($body) => {
        if ($body.find('button.MuiTab-root:contains("Attributes")').length > 0) {
          cy.get('button.MuiTab-root').contains('Attributes').click();
        }
      });
      // Wait for attributes to load
      cy.get('.MuiListItemText-root, .MuiTypography-h5', { timeout: 10000 }).should('be.visible');
      cy.muiTraceAttributes(
        {
          'network.peer.address': { value: ['1.2.3.4', '127.0.0.1'] },
          'peer.service': {
            value: (text) => ['telemetrygen-server', 'telemetrygen-client'].includes(text),
          },
          'k8s.container.name': { value: 'telemetrygen', optional: true },
          'k8s.namespace.name': {
            value: (text) =>
              [
                'chainsaw-test-rbac-1',
                'chainsaw-test-rbac-2',
                'chainsaw-mono-rbac-1',
                'chainsaw-mono-rbac-2',
              ].includes(text),
            optional: true,
          },
          'service.name': {
            value: (text) =>
              ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2'].includes(text),
          },
        },
        'TempoStack',
      );

      cy.log('Rerun the steps and select span links from the Traces page');
      cy.pfBreadcrumb('Traces').click();
      cy.pfCloseButtonIfExists('Close chip group');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();
      cy.pfMenuToggle('Service Name').click();
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem('http-rbac-1');
      cy.pfCheckMenuItem('http-rbac-2');
      cy.pfCheckMenuItem('grpc-rbac-1');
      cy.pfCheckMenuItem('grpc-rbac-2');
      cy.muiFirstTraceLink().click();
      cy.get('[data-testid="LaunchIcon"]').first().click();
      cy.get('a[role="menuitem"]').contains('Open linked span').first().click();
      // Wait for attributes panel to load
      cy.get('.MuiListItemText-root', { timeout: 10000 }).should('be.visible');
      cy.muiTraceAttributes(
        {
          'network.peer.address': { value: ['1.2.3.4', '127.0.0.1'] },
          'peer.service': {
            value: (text) => ['telemetrygen-server', 'telemetrygen-client'].includes(text),
          },
          'k8s.container.name': { value: 'telemetrygen', optional: true },
          'k8s.namespace.name': {
            value: (text) =>
              [
                'chainsaw-test-rbac-1',
                'chainsaw-test-rbac-2',
                'chainsaw-mono-rbac-1',
                'chainsaw-mono-rbac-2',
              ].includes(text),
            optional: true,
          },
          'service.name': {
            value: (text) =>
              ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2'].includes(text),
          },
        },
        'TempoMonolithic',
      );

      cy.log('Assert traces in TempoMonolithic instance.');
      cy.pfBreadcrumb('Traces').click();
      cy.pfCloseButtonIfExists('Close chip group');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-mmo-rbac / mmo-rbac').click();
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();
      cy.pfMenuToggle('Service Name').click();
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem('http-rbac-1');
      cy.pfCheckMenuItem('http-rbac-2');
      cy.pfCheckMenuItem('grpc-rbac-1');
      cy.pfCheckMenuItem('grpc-rbac-2');
      cy.muiFirstTraceLink().click();
      // Wait for trace detail page to fully render span bars before clicking
      cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 1);
      cy.findByTestId('span-duration-bar').eq(1).click();
      // Wait for attributes panel to load
      cy.get('.MuiListItemText-root', { timeout: 10000 }).should('be.visible');
      cy.muiTraceAttributes(
        {
          'network.peer.address': { value: ['1.2.3.4', '127.0.0.1'] },
          'peer.service': {
            value: (text) => ['telemetrygen-server', 'telemetrygen-client'].includes(text),
          },
          'k8s.container.name': { value: 'telemetrygen', optional: true },
          'k8s.namespace.name': {
            value: (text) =>
              [
                'chainsaw-test-rbac-1',
                'chainsaw-test-rbac-2',
                'chainsaw-mono-rbac-1',
                'chainsaw-mono-rbac-2',
              ].includes(text),
            optional: true,
          },
          'service.name': {
            value: (text) =>
              ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2'].includes(text),
          },
        },
        'TempoMonolithic',
      );

      cy.log('Navigate to the traces page and close the chip group.');
      cy.pfBreadcrumb('Traces').click();
      cy.pfCloseButtonIfExists('Close chip group');
    });

    it('[Capability:UIPlugin][Capability:TraceLimits] Test trace limit functionality', () => {
      cy.log('Navigate to the observe/traces page');
      cy.reload();
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 30000 }).should('exist');

      cy.log('Select TempoStack instance: chainsaw-rbac / simplst');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

      cy.log('Select tenant: dev');
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();

      cy.log('Select Namespace filter type');
      cy.pfMenuToggle('Service Name').click();
      cy.pfSelectMenuItem('Namespace').click();
      cy.log('Filter by namespace: chainsaw-rbac');
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem('chainsaw-rbac');

      cy.log('Set trace limit to 50 (but verify actual available count)');
      cy.menuToggleContains('20');
      cy.wait(500);
      cy.pfSelectMenuItem('50').click();
      cy.verifyTraceCount(50);

      cy.log('Set trace limit to 10 and verify fewer traces shown');
      cy.menuToggleContains('50');
      cy.wait(500);
      cy.pfSelectMenuItem('20').click();
      cy.verifyTraceCount(20);
    });

    it('[Capability:UIPlugin][Capability:TraceVisualization][Capability:TimeRange] Test Distributed Traces Cutoffbox functionality', () => {
      // Setup the trace page with tempo instance and filters
      cy.setupTracePage('chainsaw-rbac / simplst', 'dev', 'Last 15 minutes', 'frontend');

      // Navigate to trace details
      cy.navigateToTraceDetails();

      cy.log('Test MUI box cutoff functionality by interacting with resizer');

      // Store the original time range values for comparison
      cy.get('[style*="left: 25%"]')
        .contains(/\d+(\.\d+)?(μs|ms|s)/)
        .invoke('text')
        .as('secondTimeValue');

      // Drag the right resizer to 50% position
      cy.dragCutoffResizer(50, 'right');

      // Verify the cutoff box is positioned correctly (around 50%)
      cy.verifyCutoffPosition(50, 2); // 50% ± 2% tolerance

      // Verify that the time range has been updated to reflect the cutoff selection
      cy.log('Verify the time range reflects the cutoff selection');
      cy.get('@secondTimeValue').then(() => {
        // Check that the updated time range shows values around the selected area
        cy.get('[style*="left: 0%"][style*="border-width: 0px"]')
          .should('be.visible')
          .and('not.be.empty');

        // Verify that the range shows millisecond values that align with the cutoff
        cy.get('[style*="left: 100%"] span[style*="position: absolute; right: 0.75rem"]')
          .should('be.visible')
          .invoke('text')
          .should('match', /\d+(\.\d+)?(μs|ms|s)/); // Should match time format

        cy.log('✓ MUI box cutoff functionality verified - time range updated correctly');
      });
    });

    it('[Capability:UIPlugin][Capability:AIIntegration][Capability:Lightspeed] Test AI Traces summary with OpenShift Lightspeed', () => {
      cy.log('Navigate to the /observe/traces page');
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('body').should('be.visible');
      // Wait for the page to fully render
      cy.wait(3000);

      cy.log('Select TempoStack instance: chainsaw-rbac / simplst');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

      cy.log('Select tenant: dev');
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();

      cy.log('Select time range: Last 15 minutes');
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();

      cy.log('Select service name: frontend');
      cy.pfMenuToggle('Service Name').click();
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem('frontend');

      cy.log('Click on the first trace');
      cy.muiFirstTraceLink().click();

      cy.log('Wait for trace details to load and click Ask OpenShift Lightspeed button');
      cy.get(
        'button.pf-c-button.pf-m-plain[aria-label="Ask OpenShift Lightspeed"], button.pf-v5-c-button.pf-m-plain[aria-label="Ask OpenShift Lightspeed"], button.pf-v6-c-button.pf-m-plain[aria-label="Ask OpenShift Lightspeed"]',
        { timeout: 10000 },
      )
        .filter(':visible')
        .first()
        .click();

      cy.log('Verify Lightspeed popover panel is visible');
      olsHelpers.verifyPopoverVisible();

      cy.log('Verify Lightspeed panel title');
      cy.contains('h1', 'Red Hat OpenShift Lightspeed').should('be.visible');

      cy.log('Verify the prompt input textarea has the expected text');
      cy.get(OLS_SELECTORS.promptInput)
        .should('be.visible')
        .and(
          'have.value',
          'Analyze this distributed trace from my OpenShift cluster and summarize: errors, services needing investigation and performance bottlenecks.',
        );

      cy.log('Verify the trace context attachment is present');
      cy.get('.ols-plugin__context-label-text')
        .should('be.visible')
        .and('have.text', 'frontend: GET /dispatch');

      olsHelpers.submitPrompt();

      cy.log('Wait for AI response and verify trace analysis content');
      olsHelpers.waitForAIResponse();
      olsHelpers.getAIResponse().should('contain.text', 'trace');

      cy.log('Verify AI response contains analysis of trace services');
      olsHelpers.getAIResponse().should(($message) => {
        const text = $message.text().toLowerCase();
        // Verify at least 2 of the key services are mentioned
        const serviceMatches = [
          text.includes('driver'),
          text.includes('customer'),
          text.includes('route'),
          text.includes('frontend') || text.includes('dispatch'),
        ].filter(Boolean);
        expect(serviceMatches.length).to.be.at.least(
          2,
          'Expected at least 2 services to be mentioned in the analysis',
        );
      });

      cy.log('Verify AI response mentions Redis or database interactions');
      olsHelpers.getAIResponse().should(($message) => {
        const text = $message.text().toLowerCase();
        expect(text).to.match(/redis|database|mysql/);
      });

      cy.log('✓ AI Traces summary with OpenShift Lightspeed verified');
      olsHelpers.waitForPopoverAndClose();
    });

    it('[Capability:UIPlugin][Capability:TraceQLQuery][Capability:EmptyState] Test TraceQL query with no results and clear filters functionality', () => {
      cy.log('Navigate to the /observe/traces page');
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('body').should('be.visible');
      cy.wait(3000);

      cy.log('Select chainsaw-rbac/simplst Tempo instance');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

      cy.log('Select tenant: dev');
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();

      cy.log('Click Show query button');
      cy.pfButton('Show query').should('be.visible').click();
      cy.wait(1000);

      cy.log('Clear existing query and enter new TraceQL query: { name = "/test" }');
      // CodeMirror is a React-controlled component (value={query}, onChange={setQuery}).
      // DOM mutations like execCommand have no effect. We must use CodeMirror's EditorView
      // dispatch API which triggers the onChange callback and updates React state.
      // The EditorView is accessed via: .cm-content -> cmView -> rootView -> view
      cy.get('.cm-content[contenteditable="true"]', { timeout: 10000 }).then(($content) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CodeMirror internals
        const contentView = ($content[0] as any).cmView;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- chai assertion
        expect(contentView, 'CodeMirror ContentView should be accessible').to.not.be.undefined;
        const editorView = contentView.rootView?.view;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- chai assertion
        expect(editorView, 'CodeMirror EditorView should be accessible').to.not.be.undefined;
        editorView.dispatch({
          changes: { from: 0, to: editorView.state.doc.length, insert: '{ name = "/test" }' },
        });
      });
      cy.wait(500);

      cy.log('Verify query text was entered correctly');
      cy.get('.cm-line', { timeout: 10000 }).should('contain.text', 'name');

      cy.log('Click Run query button');
      cy.pfButton('Run query').should('be.visible').click();
      cy.wait(3000);

      cy.log('Verify empty state message appears');
      cy.pfEmptyState().within(() => {
        cy.get('.pf-v6-c-empty-state__body, .pf-v5-c-empty-state__body, .pf-c-empty-state__body')
          .should('be.visible')
          .and(
            'contain.text',
            'No results match this query criteria. Clear all filters and try again.',
          );
      });

      cy.log('Click Clear all filters button');
      cy.pfButton('Clear all filters').should('be.visible').click();
      cy.wait(2000);

      cy.log('Verify query text box has been reset to {}');
      cy.get('.cm-content[contenteditable="true"]')
        .should('be.visible')
        .invoke('text')
        .should('match', /^\s*\{\s*\}\s*$/);

      cy.log('Verify trace details page is now visible with traces');
      cy.get('a.MuiLink-root', { timeout: 10000 }).should('be.visible');
      cy.log('✓ TraceQL query with no results and clear filters functionality verified');
    });

    it('[Capability:UIPlugin][Capability:CustomTimeRange] Test custom time range selection and preset switching', () => {
      cy.log('Navigate to the /observe/traces page');
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 30000 }).should('exist');

      cy.log('Select TempoStack instance: chainsaw-rbac / simplst');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

      cy.log('Select tenant: dev');
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();

      cy.log('Select preset time range: Last 1 hour');
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();

      cy.log('Verify traces appear with the preset time range');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Verify URL contains the relative time range parameter');
      cy.url().should('include', 'start=1h');

      cy.log('Open the time range dropdown and select Custom Time Range');
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Custom Time Range').click();

      cy.log('Verify the DateTimeRangePicker popover opens with expected elements');
      cy.contains('.MuiPopover-paper', 'Apply', { timeout: 10000 })
        .should('be.visible')
        .as('datePickerPopover');

      cy.get('@datePickerPopover').within(() => {
        cy.contains('Select Start Time').should('be.visible');
        cy.get('label').contains('Start Time').should('exist');
        cy.get('label').contains('End Time').should('exist');
        cy.get('button.MuiButton-contained').contains('Apply').should('be.visible');
        cy.get('button.MuiButton-outlined').contains('Cancel').should('be.visible');
      });

      cy.log('Apply the pre-populated custom time range');
      cy.get('@datePickerPopover').within(() => {
        cy.get('button.MuiButton-contained').contains('Apply').click();
      });

      cy.log('Verify the popover closes after Apply');
      cy.contains('.MuiPopover-paper', 'Apply').should('not.exist');

      cy.log('Verify URL switches to absolute time range parameters');
      cy.url().should('match', /start=\d+/);
      cy.url().should('match', /end=\d+/);
      cy.url().should('not.include', 'start=1h');

      cy.log('Verify the time range dropdown displays the custom date range');
      cy.muiSelect('Select time range')
        .invoke('text')
        .should('match', /\d{4}-\d{2}-\d{2}/);

      cy.log('Verify traces are still visible within the custom time range');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Reopen custom time range to test Cancel flow');
      cy.muiSelect('Select time range').click();
      cy.get('[role="listbox"] [role="option"]').last().click();

      cy.log('Verify the DateTimeRangePicker popover opens');
      cy.contains('.MuiPopover-paper', 'Apply', { timeout: 10000 }).should('be.visible');

      cy.log('Click Cancel without making changes');
      cy.contains('.MuiPopover-paper', 'Apply').within(() => {
        cy.get('button.MuiButton-outlined').contains('Cancel').click();
      });

      cy.log('Verify the popover closes after Cancel');
      cy.contains('.MuiPopover-paper', 'Apply').should('not.exist');

      cy.log('Verify the previous custom time range is preserved in URL');
      cy.url().should('match', /start=\d+/);
      cy.url().should('match', /end=\d+/);

      cy.log('Switch back to preset: Last 1 hour');
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();

      cy.log('Verify URL reverts to relative time range');
      cy.url().should('include', 'start=1h');

      cy.log('Verify traces are visible with the preset time range');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');
    });

    it('[Capability:UIPlugin][Capability:ScatterPlot] Test scatter plot visibility toggle and trace navigation', () => {
      cy.log('Navigate to the /observe/traces page');
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 30000 }).should('exist');

      cy.log('Select TempoStack instance: chainsaw-rbac / simplst');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

      cy.log('Select tenant: dev');
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();

      cy.log('Select time range: Last 1 hour');
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();

      cy.log('Wait for traces to load');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Verify scatter plot container and canvas are rendered');
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"]', { timeout: 10000 }).should(
        'be.visible',
      );
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas').should('exist');

      cy.log('Test Hide graph toggle');
      cy.contains('button', 'Hide graph').should('be.visible').click();
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"]').should('not.exist');

      cy.log('Test Show graph toggle');
      cy.contains('button', 'Show graph').should('be.visible').click();
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"]', { timeout: 10000 }).should(
        'be.visible',
      );
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas').should('exist');

      cy.log('Verify scatter plot ECharts container has instance attribute');
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] > div').should(
        'have.attr',
        '_echarts_instance_',
      );

      cy.log('Trigger tooltip by hovering over scatter plot canvas');
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas')
        .first()
        .trigger('mousemove', 'center', { force: true });
      cy.wait(1000);

      cy.log('Verify tooltip content if visible');
      cy.get('body').then(($body) => {
        if ($body.find('div:contains("Service name")').length > 0) {
          cy.contains('Service name').should('be.visible');
          cy.contains('Span name').should('be.visible');
          cy.contains('Duration').should('be.visible');
          cy.contains('Span count').should('be.visible');
          cy.log('Tooltip verified with trace details');
        } else {
          cy.log('Tooltip not rendered at center position, skipping tooltip content check');
        }
      });

      cy.log('Verify scatter plot renders data points by checking canvas is non-empty');
      cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas')
        .first()
        .then(($canvas) => {
          const canvas = $canvas[0] as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hasContent = imageData.data.some((val, idx) => idx % 4 !== 3 && val !== 0);
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- chai assertion
          expect(hasContent, 'Canvas should have rendered content (axes, data points)').to.be.true;
        });
    });

    it('[Capability:UIPlugin][Capability:AttributeFilters] Test attribute-based filtering with Span Name, Status, and Span Duration filters', () => {
      cy.log('Navigate to the /observe/traces page');
      cy.visit('/observe/traces');
      cy.url().should('include', '/observe/traces');
      cy.dismissWelcomeModal();
      cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 30000 }).should('exist');

      cy.log('Select TempoStack instance: chainsaw-rbac / simplst');
      cy.pfTypeahead('Select a Tempo instance').click();
      cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

      cy.log('Select tenant: dev');
      cy.pfTypeahead('Select a tenant').click();
      cy.pfSelectMenuItem('dev').click();

      cy.log('Select time range: Last 1 hour');
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption('Last 1 hour').click();

      cy.log('Wait for traces to load');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Switch filter type to Span Name');
      cy.contains('label', 'Filter')
        .parents('.pf-v6-c-form__group, .pf-v5-c-form__group')
        .first()
        .find('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle')
        .first()
        .click();
      cy.pfSelectMenuItem('Span Name').click();

      cy.log('Open Span Name typeahead and type a known span name to filter');
      cy.get('#multi-typeahead-select-checkbox-input', { timeout: 10000 })
        .should('be.visible')
        .click();
      cy.get('#multi-typeahead-select-checkbox-input').type('GET /dispatch');
      cy.get('.pf-v6-c-menu__item, .pf-v5-c-menu__item', { timeout: 10000 })
        .contains('GET /dispatch')
        .click();

      cy.log('Verify traces are still visible after Span Name filter');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Clear the Span Name filter chip group');
      cy.pfCloseButtonIfExists('Close chip group');
      cy.pfCloseButtonIfExists('Close label group');

      cy.log('Switch filter type to Status');
      cy.contains('label', 'Filter')
        .parents('.pf-v6-c-form__group, .pf-v5-c-form__group')
        .first()
        .find('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle')
        .first()
        .click();
      cy.pfSelectMenuItem('Status').click();

      cy.log('Open Status multi-select and verify predefined options');
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.get('.pf-v6-c-menu__item-text, .pf-v5-c-menu__item-text', { timeout: 10000 })
        .should('contain', 'unset')
        .and('contain', 'ok')
        .and('contain', 'error');

      cy.log('Select status: unset');
      cy.pfCheckMenuItem('unset');

      cy.log('Verify traces appear with unset status filter');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Clear the Status filter chip group');
      cy.pfCloseButtonIfExists('Close chip group');
      cy.pfCloseButtonIfExists('Close label group');

      cy.log('Switch filter type to Span Duration');
      cy.contains('label', 'Filter')
        .parents('.pf-v6-c-form__group, .pf-v5-c-form__group')
        .first()
        .find('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle')
        .first()
        .click();
      cy.pfSelectMenuItem('Span Duration').click();

      cy.log('Enter min duration: 1ms');
      cy.get('#min-duration-input').should('be.visible').clear().type('1ms');
      cy.wait(1500);

      cy.log('Verify toolbar chip shows duration filter');
      cy.get(
        '.pf-v6-c-label__content, .pf-v5-c-label__content, .pf-v6-c-chip__text, .pf-v5-c-chip__text',
        { timeout: 5000 },
      ).should('contain', '1ms');

      cy.log('Enter max duration: 10s');
      cy.get('#max-duration-input').should('be.visible').clear().type('10s');
      cy.wait(1500);

      cy.log('Verify toolbar chip shows duration range');
      cy.get(
        '.pf-v6-c-label__content, .pf-v5-c-label__content, .pf-v6-c-chip__text, .pf-v5-c-chip__text',
        { timeout: 5000 },
      )
        .should('contain', '1ms')
        .and('contain', '10s');

      cy.log('Verify traces are visible within the duration range');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Clear the Span Duration filter');
      cy.pfCloseButtonIfExists('Close chip group');
      cy.pfCloseButtonIfExists('Close label group');

      cy.log('Switch filter type back to Service Name');
      cy.contains('label', 'Filter')
        .parents('.pf-v6-c-form__group, .pf-v5-c-form__group')
        .first()
        .find('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle')
        .first()
        .click();
      cy.pfSelectMenuItem('Service Name').click();

      cy.log('Verify traces are visible without any filters');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');
    });

    it('[Capability:UIPlugin][Capability:GanttSearch] Test Gantt chart span search functionality', () => {
      cy.log('Navigate to a trace detail page to access the Gantt chart');
      cy.setupTracePage('chainsaw-rbac / simplst', 'dev', 'Last 1 hour');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');
      cy.muiFirstTraceLink().click();
      cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 0);

      cy.log('Read root span service name from trace header for use as search query');
      cy.get('.MuiTypography-h3', { timeout: 10000 })
        .first()
        .invoke('text')
        .then((headerText) => {
          // Header format: "serviceName: spanName (duration)"
          const serviceName = headerText.split(':')[0].trim();
          cy.log(`Using service name "${serviceName}" as search query`);

          cy.log('Click Toggle search button (magnify icon) to reveal the search bar');
          cy.get('button[aria-label="Toggle search"]').click();
          cy.get('input[placeholder="Search spans..."]', { timeout: 5000 }).should('be.visible');

          cy.log('Type service name — all spans from this service should match');
          cy.get('input[placeholder="Search spans..."]').type(serviceName);

          cy.log('Verify match counter shows at least one result (not 0/0)');
          cy.get('input[placeholder="Search spans..."]')
            .closest('.MuiInputBase-root')
            .find('.MuiInputAdornment-root')
            .should('be.visible')
            .invoke('text')
            .should('match', /^[1-9]\d*\/\d+$/);

          cy.log('Next match button navigates to next matching span');
          cy.get('button[aria-label="Next match"]').should('be.enabled').click();
          cy.get('input[placeholder="Search spans..."]')
            .closest('.MuiInputBase-root')
            .find('.MuiInputAdornment-root')
            .invoke('text')
            .should('match', /^\d+\/\d+$/);

          cy.log('Previous match button navigates back');
          cy.get('button[aria-label="Previous match"]').should('be.enabled').click();

          cy.log('Searching for non-existent text shows 0/0 and disables navigation buttons');
          cy.get('button[aria-label="Clear search"]').click();
          cy.get('input[placeholder="Search spans..."]').type('__nonexistent_span_xyz__');
          cy.get('input[placeholder="Search spans..."]')
            .closest('.MuiInputBase-root')
            .find('.MuiInputAdornment-root')
            .should('be.visible')
            .and('contain.text', '0/0');
          cy.get('button[aria-label="Next match"]').should('be.disabled');
          cy.get('button[aria-label="Previous match"]').should('be.disabled');

          cy.log('Clear search button resets the input to empty');
          cy.get('button[aria-label="Clear search"]').click();
          cy.get('input[placeholder="Search spans..."]').should('have.value', '');

          cy.log('Clicking Toggle search again hides the search bar');
          cy.get('button[aria-label="Toggle search"]').click();
          cy.get('input[placeholder="Search spans..."]').should('not.exist');
        });
    });

    it('[Capability:UIPlugin][Capability:AttributePaneResize] Test Gantt chart attribute pane resizing', () => {
      cy.log('Navigate to trace details and open the span attribute pane');
      cy.setupTracePage('chainsaw-rbac / simplst', 'dev', 'Last 1 hour');
      cy.navigateToTraceDetails();

      cy.log('Verify the attribute pane is open (detail Box has inline min-width style)');
      // The detail pane Box only renders when a span is selected, with an inline
      // style "min-width: <n>%" set by TracingGanttChart when a span is clicked.
      cy.get('[style*="min-width"]', { timeout: 10000 }).first().should('be.visible');

      cy.log('Record initial pane width and drag the ResizableDivider to expand it');
      cy.get('[style*="min-width"]')
        .first()
        .then(($detailPane) => {
          const initialWidth = $detailPane[0].getBoundingClientRect().width;
          cy.log(`Initial attribute pane width: ${initialWidth}px`);

          // The ResizableDivider is the previousElementSibling of the detail pane Box.
          // mousemove is captured on window (attached after mousedown sets isResizing=true),
          // but synthetic events bubble from the element up to window.
          const resizerEl = $detailPane[0].previousElementSibling as HTMLElement;
          const resizerRect = resizerEl.getBoundingClientRect();
          const ganttRect = resizerEl.parentElement!.getBoundingClientRect();

          // Target 40% from the left edge — valid within the [5%, 95%] clamp.
          // This moves the divider left so the detail pane grows from ~18% to ~60%.
          const targetX = ganttRect.left + ganttRect.width * 0.4;

          cy.wrap(resizerEl)
            .trigger('mousedown', { which: 1, force: true })
            .wait(100) // wait for React state update: isResizing→true adds mousemove to window
            .trigger('mousemove', {
              clientX: targetX,
              clientY: resizerRect.top + resizerRect.height / 2,
              force: true,
            })
            .wait(100)
            .trigger('mouseup', { force: true });

          cy.wait(500); // allow React state to settle after drag

          cy.log('Verify the attribute pane width increased after drag');
          cy.get('[style*="min-width"]')
            .first()
            .then(($resizedPane) => {
              const newWidth = $resizedPane[0].getBoundingClientRect().width;
              cy.log(`Attribute pane expanded: ${initialWidth}px → ${newWidth}px`);
              expect(newWidth).to.be.greaterThan(initialWidth);
            });
        });
    });

    it('[Capability:UIPlugin][Capability:TraceTableColumns] Test trace table Spans and Start time column rendering with word wrap', () => {
      cy.log('Set up the traces page and wait for trace data to load');
      cy.setupTracePage('chainsaw-rbac / simplst', 'dev', 'Last 1 hour');
      cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');

      cy.log('Verify the Spans column header is present');
      cy.contains('.MuiDataGrid-columnHeaderTitle', 'Spans').should('be.visible');

      cy.log('Verify Spans cells show span count text wrapped in a flex Box container');
      // PR #655 changed the Spans cell renderer from a bare React Fragment (<>...</>)
      // to a Box with flexWrap:wrap so the span count and error chip wrap on narrow columns.
      // Use .MuiDataGrid-cell to exclude the column header which also has data-field="spanCount".
      cy.get('.MuiDataGrid-cell[data-field="spanCount"]', { timeout: 10000 })
        .first()
        .as('spansCell');
      cy.get('@spansCell')
        .invoke('text')
        .should('match', /\d+ spans/);
      cy.get('@spansCell').find('.MuiBox-root').should('exist');

      cy.log('Verify the Start time column header is present');
      cy.contains('.MuiDataGrid-columnHeaderTitle', 'Start time').should('be.visible');

      cy.log('Verify Start time cells contain a date/time value');
      // PR #655 reduced the Start time column minWidth (240→110) and flex (3→2)
      // to enable word wrap; the cell itself renders a locale date string.
      cy.get('.MuiDataGrid-cell[data-field="startTimeUnixMs"]')
        .first()
        .invoke('text')
        .should('not.be.empty');
    });

    it('[Capability:UIPlugin][Capability:TLSCertRotation] Test dynamic TLS certificate rotation without pod restart', function () {
      cy.runChainsawTest('cert-rotation', 'TLS certificate rotation', { timeout: 600000 });
    });

    it('[Capability:UIPlugin][Capability:TLSProfile] Test TLS profile configuration on plugin endpoints', function () {
      // Setup: install tls-scanner and scale down operator.
      // scale_down_operator() in tls-helpers.sh re-registers the plugin in
      // consoles/cluster spec.plugins and annotates the ConsolePlugin CR so the
      // console bridge re-checks the plugin immediately after the operator stops.
      cy.runChainsawTest('tls-profile-setup', 'TLS profile setup');
      // Verify the plugin is still accessible after the operator scale-down before
      // proceeding with profile-specific changes. Fails fast if scale_down_operator()
      // did not fully restore console registration.
      cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');

      // Test default Intermediate profile (TLS 1.2 + TLS 1.3)
      cy.runChainsawTest('tls-profile-intermediate', 'Intermediate TLS profile');
      cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');

      // Test Modern profile (TLS 1.3 only)
      cy.runChainsawTest('tls-profile-modern', 'Modern TLS profile');
      cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');

      // Test Custom cipher suites
      cy.runChainsawTest('tls-profile-custom-ciphers', 'Custom cipher suites');
      cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');

      // Test Old profile (TLS 1.0+)
      cy.runChainsawTest('tls-profile-old', 'Old TLS profile');
      cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');

      // Revert to default, scale operator back up, cleanup tls-scanner
      cy.runChainsawTest('tls-profile-revert', 'Revert to default');
      cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');
    });

    it('[Capability:OperatorLifecycle][Capability:Installation] Test "Install Tempo operator" if operator is not installed', () => {
      // Pre-flight: scale COO operator to 1 in case TLSProfile test left it at 0 replicas.
      // Without this, the plugin pod is unavailable and the page shows 404.
      cy.log('Pre-flight: Ensure COO operator is running at 1 replica');
      cy.exec(
        `oc scale deployment observability-operator -n ${DTP.namespace} --replicas=1 --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true; echo "done"`,
        { failOnNonZeroExit: false, timeout: 30000 },
      );
      cy.exec(
        `for i in $(seq 1 24); do POD=$(oc get pods --selector=app.kubernetes.io/instance=distributed-tracing -n ${DTP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} -o name 2>/dev/null | head -1); if [ -n "$POD" ]; then oc wait --for=condition=Ready $POD -n ${DTP.namespace} --timeout=30s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null && exit 0; fi; echo "Plugin pod not ready yet (attempt $i/24), waiting 5s..."; sleep 5; done; echo "Plugin pod check done"; exit 0`,
        { failOnNonZeroExit: false, timeout: 150000 },
      );

      cy.log('Delete Chainsaw test namespaces and resources');
      cy.exec(
        `for ns in $(oc get projects -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} | grep "chainsaw-" | sed 's|project.project.openshift.io/||'); do oc get opentelemetrycollectors.opentelemetry.io,tempostacks.tempo.grafana.com,tempomonolithics.tempo.grafana.com,pvc -n $ns -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null | xargs --no-run-if-empty -I {} oc patch {} -n $ns --type merge -p '{"metadata":{"finalizers":[]}}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null || true; oc delete project $ns --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || true; done`,
        {
          timeout: 300000,
          failOnNonZeroExit: false,
        },
      );

      cy.log('Delete Tempo Operator namespace and wait for deletion');
      cy.executeAndDelete(
        `oc delete namespace ${TEMPO.namespace} --wait=true --timeout=300s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Delete Tempo Operator and wait for deletion');
      cy.executeAndDelete(
        `oc delete operator tempo-product.${TEMPO.namespace} --wait=true --timeout=300s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Delete Tempo CustomResourceDefinitions');
      cy.executeAndDelete(
        `oc delete customresourcedefinitions.apiextensions.k8s.io tempomonolithics.tempo.grafana.com tempostacks.tempo.grafana.com --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log(
        'Navigate to the observe/traces page, retrying until plugin shows "Tempo operator isn\'t installed yet"',
      );
      // After deleting Tempo CRDs the plugin shows the correct empty state. If the console
      // hasn't refreshed its plugin routes (e.g. after TLSProfile left operator at 0 replicas),
      // the page may show 404. Retry until the plugin page loads correctly.
      const retryIntervalInstallMs = 10000;
      const maxInstallRetries = 18; // 3 minutes
      const waitForInstallationPage = (retriesLeft: number) => {
        cy.visit('/observe/traces');
        cy.url().should('include', '/observe/traces');
        cy.dismissWelcomeModal();
        // Give the console time to load plugins and render the page before checking it;
        // checking right after the visit can run before the plugin page has rendered.
        cy.wait(retryIntervalInstallMs);
        cy.get('body').then(($body) => {
          if ($body.text().includes("Tempo operator isn't installed yet")) {
            cy.log('Plugin shows correct "Tempo operator isn\'t installed yet" state');
          } else if (retriesLeft > 0) {
            cy.log(
              `Plugin not ready yet (body: "${$body.text().substring(0, 100)}..."), ` +
                `retrying (${retriesLeft} left)...`,
            );
            waitForInstallationPage(retriesLeft - 1);
          } else {
            cy.log('WARNING: Plugin did not show expected state after maximum retries');
          }
        });
      };
      waitForInstallationPage(maxInstallRetries);

      cy.log('Verify empty state shows "Tempo operator isn\'t installed yet"');
      cy.pfEmptyState().within(() => {
        cy.get('h1, h2, h3, h4, h5, h6').should(
          'contain.text',
          "Tempo operator isn't installed yet",
        );
      });

      cy.log('Verify "Install Tempo operator" button is visible');
      cy.pfButton('Install Tempo operator').should('be.visible');

      cy.log('Click the "Install Tempo operator" button');
      cy.pfButton('Install Tempo operator').click();

      cy.log('Verify redirect to OperatorHub Tempo Operator page');
      cy.url({ timeout: 30000 }).should('match', /\/(operatorhub|catalog)\//);
      cy.url().should('match', /tempo/i);

      cy.log('Wait for page body to be visible');
      cy.get('body').should('be.visible');

      cy.log('Wait for catalog page to load completely');
      cy.wait(3000);

      cy.dismissWelcomeModal();

      cy.log('Verify Tempo Operator is shown on the catalog/OperatorHub page');
      // OCP 4.22+ uses a "Software Catalog" page with tiles; older versions show an OperatorHub
      // modal
      cy.get('body', { timeout: 60000 }).should('contain.text', 'Tempo');
      cy.get('body').then(($body) => {
        if (
          $body.find(
            '[data-test="catalog-details-modal-cta"], [data-test-id="operator-install-btn"]',
          ).length > 0
        ) {
          cy.log('Found OperatorHub install button (pre-4.22 flow)');
        } else {
          cy.log('Catalog page detected (4.22+ flow), verifying Tempo Operator tile is visible');
          cy.contains('Tempo Operator').should('be.visible');
        }
      });

      cy.log('✓ "Install Tempo operator" button successfully redirects to OperatorHub');
    });
  },
);
