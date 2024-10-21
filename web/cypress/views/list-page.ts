export const listPage = {
  titleShouldHaveText: (title: string) =>
    cy
      .byLegacyTestID('resource-title')
      .contains(title)
      .should('exist'),
  filter: {
    byName: (name: string) => {
      cy.byTestID('name-filter-input')
        .clear()
        .type(name);
    },
  },
  rows: {
    shouldBeLoaded: () => {
      cy.get(`[data-test-rows="resource-row"`).should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.get(`[data-test-rows="resource-row"`).should('have.length', count);
    },
    shouldExist: (resourceName: string) =>
      cy.get(`[data-test-rows="resource-row"]`).contains(resourceName),
  },
};
