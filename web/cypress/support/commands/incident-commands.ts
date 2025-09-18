export {};

declare global {
    namespace Cypress {
      interface Chainable {
        createKubePodCrashLoopingAlert(): Chainable<string>;
        cleanupIncidentPrometheusRules(): Chainable<Element>;
      }
    }
  }


// Apply incident fixture manifests to the cluster
Cypress.Commands.add('createKubePodCrashLoopingAlert', () => {
    const kubeconfigPath = Cypress.env('KUBECONFIG_PATH');
    
    // Generate a random alert name for this test run
    const randomAlertName = `CustomPodCrashLooping_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store the alert name globally so tests can access it
    Cypress.env('CURRENT_ALERT_NAME', randomAlertName);
    
    cy.log(`Generated random alert name: ${randomAlertName}`);
    
    // Read the template and replace the placeholder
    cy.readFile('./cypress/fixtures/incidents/prometheus_rule_pod_crash_loop.yaml').then((template) => {
      const yamlContent = template.replace(/\{\{ALERT_NAME\}\}/g, randomAlertName);
      
      // Write the modified YAML to a temporary file
      cy.writeFile('./cypress/fixtures/incidents/temp_prometheus_rule.yaml', yamlContent).then(() => {
        // Apply the modified YAML
        cy.exec(
          `oc apply -f ./cypress/fixtures/incidents/temp_prometheus_rule.yaml --kubeconfig ${kubeconfigPath}`,
        );
        
        // Clean up temporary file
        cy.exec('rm ./cypress/fixtures/incidents/temp_prometheus_rule.yaml');
      });
    });
    
    cy.exec(
      `oc apply -f ./cypress/fixtures/incidents/pod_crash_loop.yaml --kubeconfig ${kubeconfigPath}`,
    );
    
    // Return the alert name for the test to use
    return cy.wrap(randomAlertName);
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

