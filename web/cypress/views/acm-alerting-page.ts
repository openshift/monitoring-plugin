export const acmAlertingPage = {
  shouldBeLoaded: () => {
    cy.log('acmAlertingPage.shouldBeLoaded');
    cy.get('body', { timeout: 60000 }).should('contain.text', 'Alerting');
    cy.get('section.pf-v6-c-page__main-section h1').should('have.text', 'Alerting')
    // To Do:
    // other page check could be list here
  },
};