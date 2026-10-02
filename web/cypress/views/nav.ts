import { Classes } from '../../src/components/data-test';
export const nav = {
  sidenav: {
    clickNavLink: (path: string[]) => {
      cy.log('Click navLink - ' + `${path}`);
      cy.clickNavLink(path);
      cy.wait(2000);
    },
    switcher: {
      changePerspectiveTo: (...perspectives: string[]) => {
        const perspectivePattern = new RegExp(
          `^(?:${perspectives.map(Cypress._.escapeRegExp).join('|')})$`,
          'i',
        );
        cy.byLegacyTestID('perspective-switcher-toggle')
          .should('be.visible')
          .scrollIntoView()
          .click({ force: true });
        cy.byLegacyTestID('perspective-switcher-menu-option', { timeout: 30000 })
          .contains(perspectivePattern, { timeout: 30000 })
          .should('be.visible')
          .click({ force: true });
        cy.wait(2000);
      },
      shouldHaveText: (perspective: string) => {
        cy.log('Should have text - ' + `${perspective}`);
        cy.byLegacyTestID('perspective-switcher-toggle').contains(perspective).should('be.visible');
      },
    },
  },
  tabs: {
    /**
     * Switch to a tab by name
     * @param tabname - The name of the tab to switch to
     */
    switchTab: (tabname: string) => {
      cy.get(Classes.HorizontalNav).contains(tabname).should('be.visible').click({ force: true });
      cy.wait(2000);
    },
  },
};
