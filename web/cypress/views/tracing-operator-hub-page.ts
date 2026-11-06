import * as helperfuncs from '../views/utils';

export const tracingOperatorHubPage = {
  installOperator: (operatorName, csName, installNamespace?) => {
    cy.visit(
      `/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}` +
        '&catalogNamespace=openshift-marketplace',
    );
    cy.get('body').should('be.visible');
    cy.dismissWelcomeModal();

    // Wait for page to fully load - look for install button as a sign the page is ready
    cy.get('[data-test="install-operator"]').should('be.visible');

    if (installNamespace) {
      // Custom namespace installation flow
      cy.log(`Installing operator in custom namespace: ${installNamespace}`);

      // Wait for the "A specific namespace on the cluster" radio button to be available
      cy.get('input[data-test="A specific namespace on the cluster-radio-input"]').should(
        'be.visible',
      );

      // Check if it's already selected, if not click it
      cy.get('input[data-test="A specific namespace on the cluster-radio-input"]').then(
        ($radio) => {
          if (!$radio.is(':checked')) {
            cy.get('input[data-test="A specific namespace on the cluster-radio-input"]').click();
          }
        },
      );

      // Step 1: Click "Select a Namespace" radio button (this shows the dropdown)
      cy.get('input[data-test="Select a Namespace-radio-input"]').should('be.visible');
      cy.get('input[data-test="Select a Namespace-radio-input"]').click();

      // Step 2: Wait for "Select Project" dropdown to appear and click it
      cy.get('[data-test="dropdown-selectbox"]').should('be.visible').click();

      // Step 3: Click "Create Project" button
      cy.get('button[data-test-dropdown-menu="Create_Project"]').click();

      // Step 4: Fill in the project name in the modal
      cy.get('input[data-test="input-name"]').should('be.visible').clear().type(installNamespace);

      // Step 5: Click Create button to create the project
      cy.get('[data-test="confirm-action"]').click();

      // Step 6: Wait for Install button to be available after namespace creation
      cy.get('[data-test="install-operator"]', { timeout: 60000 }).should('be.visible');
    } else {
      // Recommended namespace installation flow
      cy.log('Installing operator using recommended namespace');

      // Check which radio button is initially selected (All namespaces vs A specific namespace)
      cy.get('body').then(($body) => {
        const allNamespacesChecked =
          $body.find('[data-test="All namespaces on the cluster-radio-input"]:checked').length > 0;
        const specificNamespaceChecked =
          $body.find('[data-test="A specific namespace on the cluster-radio-input"]:checked')
            .length > 0;

        if (allNamespacesChecked) {
          cy.log('All namespaces is selected by default');
        } else if (specificNamespaceChecked) {
          cy.log('A specific namespace is selected by default');
        }
      });

      // Click operator recommended namespace radio button
      // Support both old and new OpenShift versions
      cy.get('body').then(($body) => {
        if ($body.find('#operator-namespace-recommended').length > 0) {
          // New method: use ID selector
          cy.get('#operator-namespace-recommended').click();
        } else {
          // Old method: use data-test attribute
          cy.get('[data-test="Operator recommended Namespace:-radio-input"]').click();
        }
      });

      // Enable monitoring checkbox if it exists (only for recommended namespace)
      helperfuncs.clickIfExist('[data-test="enable-monitoring"]');
    }

    // Final step: Click Install button
    cy.get('[data-test="install-operator"]').should('be.visible').click();
  },

  checkOperatorStatus: (csvName, csvStatus) => {
    // Filter by operator name
    cy.get('input[data-test="name-filter-input"]').clear().type(`${csvName}`);

    // Check operator status
    cy.get(`[data-test-operator-row="${csvName}"]`, { timeout: 120000 })
      .parents('tr')
      .children()
      .contains(`${csvStatus}`, { timeout: 120000 });
  },
};
