export { };

declare global {
    namespace Cypress {
      interface Chainable {
        setupPersesRBACandExtraDashboards(): Chainable<void>;
        cleanupExtraDashboards(): Chainable<void>;
      }
    }
  }

Cypress.Commands.add('setupPersesRBACandExtraDashboards', () => {

  if (`${Cypress.env('LOGIN_USERNAME1')}` !== 'kubeadmin' && `${Cypress.env('LOGIN_USERNAME2')}` !== undefined) {
    cy.exec(
      './cypress/fixtures/coo/coo141_perses/rbac/rbac_perses_e2e_ci_users.sh',
      {
        env: {
          USER1: `${Cypress.env('LOGIN_USERNAME1')}`,
          USER2: `${Cypress.env('LOGIN_USERNAME2')}`,
        },
      }
    );

    cy.log('Create openshift-cluster-sample-dashboard instance.');
    cy.exec(`sed 's/namespace: openshift-cluster-observability-operator/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/openshift-cluster-sample-dashboard.yaml | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create perses-dashboard-sample instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/perses-dashboard-sample.yaml | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create prometheus-overview-variables instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/prometheus-overview-variables.yaml | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create thanos-compact-overview-1var instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-compact-overview-1var.yaml | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create Thanos Querier instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-querier-datasource.yaml | oc apply -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  }
});

Cypress.Commands.add('cleanupExtraDashboards', () => {

    cy.log('Remove openshift-cluster-sample-dashboard instance.');
    cy.exec(`sed 's/namespace: openshift-cluster-observability-operator/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/openshift-cluster-sample-dashboard.yaml | oc delete -f - --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove perses-dashboard-sample instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/perses-dashboard-sample.yaml | oc delete -f - --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove prometheus-overview-variables instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/prometheus-overview-variables.yaml | oc delete -f - --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove thanos-compact-overview-1var instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-compact-overview-1var.yaml | oc delete -f - --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove Thanos Querier instance.');
    cy.exec(`sed 's/namespace: perses-dev/namespace: observ-test/g' ./cypress/fixtures/coo/coo141_perses/dashboards/thanos-querier-datasource.yaml | oc delete -f - --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Remove observ-test namespace');
    cy.exec(`oc delete namespace observ-test --ignore-not-found --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

});

