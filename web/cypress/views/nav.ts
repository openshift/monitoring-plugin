import { Classes } from '../../src/components/data-test';
export const nav = {
  sidenav: {
    clickNavLink: (path: string[]) => {
      cy.log('Click navLink - ' + `${path}`);
      cy.clickNavLink(path);
    },
    switcher: {
      changePerspectiveTo: (...perspectives: string[]) => {
        cy.log('changePerspectiveTo - ' + perspectives.join(' or '));
        cy.get('body').then((body) => {
          if (body.find('button[data-test-id="perspective-switcher-toggle"]:visible').length > 0) {
            cy.byLegacyTestID('perspective-switcher-toggle').scrollIntoView().click({ force: true });
            
            cy.get('[data-test-id="perspective-switcher-menu-option"]').then(($options) => {
              const foundPerspective = perspectives.find(p => $options.text().includes(p));
              if (foundPerspective) {
                cy.byLegacyTestID('perspective-switcher-menu-option')
                  .contains(foundPerspective)
                  .click({ force: true });
              } else {
                cy.log('No matching perspective found');
                cy.get('body').type('{esc}');
              }
            });
          }
        });
      },
      shouldHaveText: (perspective: string) => {
        cy.log('Should have text - ' + `${perspective}`);
        cy.byLegacyTestID('perspective-switcher-toggle').contains(perspective).should('be.visible');
      }
    }
  },
  tabs: {
    /**
     * Switch to a tab by name
     * @param tabname - The name of the tab to switch to
     */
    switchTab: (tabname: string) => {
      cy.get(Classes.HorizontalNav).contains(tabname).should('be.visible').click();
  }
}
};
