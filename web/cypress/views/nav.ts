import { Classes } from '../../src/components/data-test';
export const nav = {
  sidenav: {
    clickNavLink: (path: string[]) => {
      cy.log('Click navLink - ' + `${path}`);
      cy.clickNavLink(path);
    },
    switcher: {
      changePerspectiveTo: (perspective: string) => {
      cy.log('Switch perspective - ' + `${perspective}`);
      cy.byLegacyTestID('perspective-switcher-toggle').scrollIntoView().should('be.visible').click();
      cy.byLegacyTestID('perspective-switcher-menu-option').contains(perspective).should('be.visible').click();
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
