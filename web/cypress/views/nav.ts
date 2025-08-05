import { Classes } from '../../src/components/data-test';
export const nav = {
  sidenav: {
    clickNavLink: (path: string[]) => {
      cy.log('Click navLink - ' + `${path}`);
      cy.clickNavLink(path);
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
