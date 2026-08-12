import { Classes } from '@/shared/constants/data-test';
export const nav = {
  sidenav: {
    clickNavLink: (path: string[]) => {
      cy.log('Click navLink - ' + `${path}`);
      cy.clickNavLink(path);
      cy.wait(2000);
    },
    switcher: {
      changePerspectiveTo: (...perspectives: string[]) => {
        cy.log('changePerspectiveTo - ' + perspectives.join(', '));

        const toggleSelector = 'button[data-test-id="perspective-switcher-toggle"]:visible';
        const pollIntervalMs = 250;
        const timeoutMs = 5000;
        const deadline = Date.now() + timeoutMs;

        const openSwitcherAndSelect = () => {
          cy.byLegacyTestID('perspective-switcher-toggle').scrollIntoView().click({ force: true });

          cy.get('[data-test-id="perspective-switcher-menu-option"]').then(($options) => {
            const foundPerspective = perspectives.find((p) => $options.text().includes(p));
            if (foundPerspective) {
              cy.byLegacyTestID('perspective-switcher-menu-option')
                .contains(foundPerspective)
                .click({ force: true });
            } else {
              cy.log('No matching perspective found');
              cy.get('body').type('{esc}');
            }
          });
        };

        // The toggle is not always present, and when it is, it can take a moment to
        // render, so poll for it briefly instead of failing when it never shows up.
        const waitForToggleThenSelect = () => {
          cy.get('body').then(($body) => {
            if ($body.find(toggleSelector).length > 0) {
              openSwitcherAndSelect();
            } else if (Date.now() < deadline) {
              cy.wait(pollIntervalMs);
              waitForToggleThenSelect();
            } else {
              cy.log('Perspective switcher toggle not shown - skipping perspective change');
            }
          });
        };

        waitForToggleThenSelect();
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
      cy.get(Classes.HorizontalNav)
        .contains(tabname)
        .scrollIntoView()
        .should('be.visible')
        .click({ force: true });
      cy.wait(2000);
    },
  },
};
