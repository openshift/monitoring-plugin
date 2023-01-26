export const projectDropdown = {
  shouldNotExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('not.exist'),
};
