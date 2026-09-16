import * as helperfuncs from '../views/utils';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';

export const operatorHubPage = {
  installOperator: (operatorName, csName, installNamespace?) => {
    cy.switchPerspective(CustomerPerspectiveName.CorePlatform, 'Administrator');
    cy.visit(
      `/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}` +
        `&catalogNamespace=openshift-marketplace&targetNamespace=undefined`,
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
  uninstallOperator: (operatorName) => {
    cy.switchPerspective(CustomerPerspectiveName.CorePlatform, 'Administrator');
    cy.visit('/operatorhub/installed-operators');
    cy.get('body').should('be.visible');
    cy.byTestID('name-filter-input').clear().type(`${operatorName}{enter}`);
    cy.contains('tr', operatorName, { timeout: 120000 })
      .should('be.visible')
      .within(() => {
        cy.get('[data-test-id="kebab-button"]').click();
      });
    cy.contains('[role="menuitem"]', 'Uninstall Operator').click();
    cy.contains('button', 'Uninstall').click();
  },
  checkOperatorStatus: (csvName, csvStatus) => {
    cy.get('input[data-test="name-filter-input"]').clear().type(`${csvName}`);
    cy.get(`[data-test-operator-row="${csvName}"]`, { timeout: 120000 })
      .parents('tr')
      .children()
      .contains(`${csvStatus}`, { timeout: 120000 });
  },
};
