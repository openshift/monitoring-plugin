export const searchPage = {
  searchBy: (text) => {
    cy.get('input[data-test-id="item-filter"]').clear().type(`${text}`);
  },
};
