export {};

declare global {
    namespace Cypress {
      interface Chainable {
        createKubePodCrashLoopingAlert(testName?: string): Chainable<string>;
        cleanupIncidentPrometheusRules(): Chainable<Element>;
      }
    }
  }


Cypress.Commands.add('createKubePodCrashLoopingAlert', (testName?: string) => {
    const kubeconfigPath = Cypress.env('KUBECONFIG_PATH');
    
    const alertName = testName 
      ? `CustomPodCrashLooping_${testName}` 
      : `CustomPodCrashLooping_${Math.random().toString(36).substring(2, 15)}`;
    
    const shouldReuseResources = !!testName;
    
    cy.log(`Using alert name: ${alertName}${shouldReuseResources ? ' (reuse mode)' : ' (create new)'}`);
    
    if (!testName) {
      Cypress.env('CURRENT_ALERT_NAME', alertName);
    }
    
    const createOrUpdatePrometheusRule = () => {
      cy.readFile('./cypress/fixtures/incidents/prometheus_rule_pod_crash_loop.yaml').then((template) => {
        const yamlContent = template.replace(/\{\{ALERT_NAME\}\}/g, alertName);
        
        cy.writeFile('./cypress/fixtures/incidents/temp_prometheus_rule.yaml', yamlContent).then(() => {
          cy.exec(
            `oc apply -f ./cypress/fixtures/incidents/temp_prometheus_rule.yaml --kubeconfig ${kubeconfigPath}`,
          );
          
          cy.exec('rm ./cypress/fixtures/incidents/temp_prometheus_rule.yaml');
        });
      });
    };

    const createPod = () => {
      cy.exec(
        `oc apply -f ./cypress/fixtures/incidents/pod_crash_loop.yaml --kubeconfig ${kubeconfigPath}`,
      );
    };
    
    if (shouldReuseResources) {
      cy.exec(
        `oc get prometheusrule kubernetes-monitoring-podcrash-rules -n openshift-monitoring -o yaml --kubeconfig ${kubeconfigPath}`,
        { failOnNonZeroExit: false }
      ).then((result) => {
        if (result.code === 0 && result.stdout.includes(`alert: ${alertName}`)) {
          cy.log(`PrometheusRule with alert '${alertName}' already exists, reusing it`);
        } else {
          if (result.code === 0) {
            cy.log(`PrometheusRule exists but does not contain alert '${alertName}', updating it`);
          } else {
            cy.log('PrometheusRule does not exist, creating it');
          }
          createOrUpdatePrometheusRule();
        }
      });

      cy.exec(
        `oc get -f ./cypress/fixtures/incidents/pod_crash_loop.yaml --kubeconfig ${kubeconfigPath}`,
        { failOnNonZeroExit: false }
      ).then((result) => {
        if (result.code === 0) {
          cy.log('Crash looping pod already exists, reusing it');
        } else {
          cy.log('Crash looping pod does not exist, creating it');
          createPod();
        }
      });
    } else {
      createOrUpdatePrometheusRule();
      createPod();
    }
    
    return cy.wrap(alertName);
  });
  
  // Clean up incident fixture manifests from the cluster
  Cypress.Commands.add('cleanupIncidentPrometheusRules', () => {
    const kubeconfigPath = Cypress.env('KUBECONFIG_PATH');
    
    // Delete all PrometheusRules that match our pattern (kubernetes-monitoring-podcrash-rules)
    // This ensures cleanup before tests and after tests
    cy.exec(
      `oc delete prometheusrule kubernetes-monitoring-podcrash-rules -n openshift-monitoring --kubeconfig ${kubeconfigPath} --ignore-not-found=true`,
    );
    
    // Clear the environment variable if it exists
    if (Cypress.env('CURRENT_ALERT_NAME')) {
      Cypress.env('CURRENT_ALERT_NAME', null);
    }
    
    cy.executeAndDelete(
      `oc delete -f ./cypress/fixtures/incidents/pod_crash_loop.yaml --ignore-not-found=true --kubeconfig ${kubeconfigPath}`,
    );
  });
