export const nav = {
  sidenav: {
    clickNavLink: (path: string[]) => {
      cy.log('Click navLink - ' + `${path}`);
      cy.clickNavLink(path);
    }
  },
  tabs: {
    switchTab: (tabname: string) => {
      cy.byClass('pf-v6-c-tabs__item-text').contains(tabname).should('be.visible').click();
  }
}
};
