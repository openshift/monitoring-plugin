export const detailsPage = {
  sectionHeaderShouldExist: (sectionHeading: string) =>
    cy.get(`[data-test-section-heading="${sectionHeading}"]`).should('exist'),
  labelShouldExist: (labelName: string) => cy.byTestID('label-list').contains(labelName),
  clickPageActionButton: (action: string) => {
    cy.byLegacyTestID('details-actions')
      .contains(action)
      .click();
  },
};
