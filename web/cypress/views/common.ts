import { Classes } from '../../src/components/data-test';
export const namespaceDropdown = {
  shouldNotExist: () => cy.byLegacyTestID(Classes.NamespaceDropdown).should('not.exist'),
};
