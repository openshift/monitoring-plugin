import * as helperfuncs from '../views/utils';

export const operatorHubPage = {
  installOperator: (operatorName, csName, installNamespace?) => {
    cy.visit(
      `/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`,
    );
    cy.get('body').should('be.visible');
    if (installNamespace) {
      cy.get('[data-test="A specific namespace on the cluster-radio-input"]').click();
      helperfuncs.clickIfExist('input[data-test="Select a Namespace-radio-input"]');
      cy.get('button#dropdown-selectbox').click();
      cy.contains('span', `${installNamespace}`).click();
    }
    cy.get('[data-test="install-operator"]').click();
  },
  checkOperatorStatus: (csvName, csvStatus) => {
    cy.get('input[data-test="name-filter-input"]').clear().type(`${csvName}`);
    cy.get(`[data-test-operator-row="${csvName}"]`, { timeout: 120000 })
      .parents('tr')
      .children()
      .contains(`${csvStatus}`, { timeout: 120000 });
  },
};