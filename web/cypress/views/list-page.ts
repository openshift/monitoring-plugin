import { commonPages } from "./common";

export const listPage = {
  tableShoulBeLoaded: () => {
    cy.log('listPage.tableShoulBeLoaded');
    cy.get('[id="silences-table-scroll"]').should('be.visible');
  },

  tabShouldHaveText: (tab: string) => {
    cy.log('listPage.tabShouldHaveText');
    cy
      .byClass('pf-v6-c-tabs__item-text')
      .contains(tab)
      .should('exist');
  },

  exportAsCSV: (clearFolder: boolean, fileNameExp: RegExp, alertName: string, severity: string, state: string, total: number) => {
    cy.log('listPage.exportAsCSV');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
    if (clearFolder) {
      cy.task('clearDownloads');
    }
    cy.byClass('pf-v6-c-button pf-m-link co-virtualized-table--export-csv-button').should('be.visible').click();

    cy.waitUntil(() => {
      return cy.task('getFilesInFolder', downloadsFolder).then((currentFiles: string[]) => {
        const matchingFile = currentFiles.find(file => expectedFileNamePattern.test(file));
        if (matchingFile) {
          downloadedFileName = matchingFile;
          return true; // Resolve the promise with true
        }
        return false; // Resolve the promise with false
      });
    }, {
      timeout: 20000,
      interval: 1000,
      errorMsg: `CSV file matching "${expectedFileNamePattern}" was not downloaded within timeout.`
    });

    cy.then(() => {
      expect(downloadedFileName).to.not.be.null;
      cy.task('doesFileExist', { fileName: downloadedFileName }).should('be.true');
    });

  },


  filter: {
    /**
     * 
     * @param tab alerts-tab, silences, alerting-rules 
     * @param name 
     */
    byName: (tab: string, name: string) => {
      cy.log('listPage.filter.byName');
      try {
        if (tab == 'silences') {
          cy.get(`[id="${tab}-content"]`).find('input[data-test="name-filter-input"]')
            .as('input').should('be.visible');
          cy.get('@input', { timeout: 10000 }).type(name + '{enter}');
          cy.get('@input', { timeout: 10000 }).should('have.attr', 'value', name);

        }else {
          cy.get(`[id="${tab}-content"]`).find('button[data-test-id="dropdown-button"]').scrollIntoView().click();
          cy.byLegacyTestID('dropdown-menu').contains('Name').click();
          cy.get(`[id="${tab}-content"]`).find('input[data-test="name-filter-input"]').scrollIntoView()
            .as('input').should('be.visible');
          cy.get('@input', { timeout: 10000 }).scrollIntoView().type(name + '{enter}');
          cy.get('@input', { timeout: 10000 }).scrollIntoView().should('have.attr', 'value', name);
        }
      }
      catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    /**
     * 
     * @param tab alerts-tab, silences, alerting-rules 
     * @param label 
     */
    byLabel: (tab: string, label: string) => {
      cy.log('listPage.filter.byLabel');
      cy.get(`[id="${tab}-content"]`).find('button[data-test-id="dropdown-button"]').scrollIntoView().click();
      // cy.byLegacyTestID('dropdown-button').click();
      cy.byLegacyTestID('dropdown-menu').contains('Label').click();
      cy.get(`[id="${tab}-content"]`).find('input[data-test-id="item-filter"]').scrollIntoView()
        .as('input').should('be.visible');
      cy.get('@input', { timeout: 10000 }).scrollIntoView().type(label + '{enter}').should('have.attr', 'value', label);
      cy.byClass('pf-v6-c-label__content pf-m-clickable').scrollIntoView().contains(label).click();
    },
    /**
     * This clearAllFilters does not work as expected for Silences tab.
     * Please, refer to removeIndividualTag for Silences tab, once removeMainTag is not working as expected as well for Silences tab.
     * @param tab alerts-tab, silences, alerting-rules 
     */
    clearAllFilters: (tab: string,) => {
      cy.log('listPage.filter.clearAllFilters');
      try {
        cy.get(`[id="${tab}-content"]`).find('[class="pf-v6-c-button__text"]')
          .contains('Clear all filters').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },

    clickFilter: (toOpen: boolean, toClose: boolean) => {
      cy.log('listPage.filter.clickFilter');
      if (toOpen) {
        cy.byClass('pf-v6-c-menu-toggle').eq(0).should('be.visible').click();
      }
      if (toClose) {
        cy.byClass('pf-v6-c-menu-toggle pf-m-expanded').eq(0).should('be.visible').click();
      }
    },
    /**
     * 
     * @param open true = open, false = nothing
     * @param option 
     * @returns 
     */
    selectFilterOption: (open: boolean, option: string, close: boolean) => {
      cy.log('listPage.filter.selectFilterOption');
      if (open) {
        listPage.filter.clickFilter(open, false);
      };
      cy.byClass('co-filter-dropdown-item__name').contains(option).should('be.visible').click();
      if (close) {
        listPage.filter.clickFilter(false, close);
      };
    },

    /**
     * This removeMainTag does not work as expected for Silences tab.
     * Please, refer to removeIndividualTag for Silences tab.
     * @param tabName alerts-tab, silences, alerting-rules 
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State, alerting-rules (Alert State, Severity, Source)
     */
    removeMainTag: (tabName: string, groupTagName: string) => {
      cy.log('listPage.filter.removeMainTag');
      cy.get(`[id="${tabName}-content"]`).find('[class="pf-v6-c-label-group__label"]').contains(groupTagName).parent().next('div').children('button').click();
    },

    /**
     * 
     * @param tabName alerts-tab, silences, alerting-rules 
     * @param tagName alerts-tab: Firing, Pending, Silenced, Critical, Warning, Info, None, Platform, User
     *                silences: Active, Pending, Expired
     *                alerting-rules: Firing, Pending, Silenced, Not Firing, Critical, Warning, Info, None, Platform, User
     */
    removeIndividualTag: (tabName: string, tagName: string) => {
      cy.log('listPage.filter.removeIndividualTag');
      cy.get(`[id="${tabName}-content"]`).find('[class="pf-v6-c-label__text"]').contains(tagName).parent().next('span').children('button').click();
    },

    /**
     * 
     * @param tabName alerts-tab, silences, alerting-rules 
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State, alerting-rules (Alert State, Severity, Source)
     */
    clickOn1more: (tabName: string, groupTagName: string) => {
      cy.log('listPage.filter.clickOn1more');
      cy.get(`[id="${tabName}-content"]`).find('[class="pf-v6-c-label-group__label"]').contains(groupTagName).siblings('ul').children('li').contains('1 more').click();

    },

    /**
     * 
     * @param tabName alerts-tab, silences, alerting-rules 
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State, alerting-rules (Alert State, Severity, Source)
     */
    clickOnShowLess: (tabName: string, groupTagName: string) => {
      cy.log('listPage.filter.clickOnShowLess');
      cy.get(`[id="${tabName}-content"]`).find('[class="pf-v6-c-label-group__label"]').contains(groupTagName).siblings('ul').children('li').contains('Show less').click();

    },

  },
  ARRows: {
    shouldBeLoaded: () => {
      cy.log('listPage.ARRows.shouldBeLoaded');
      cy.byOUIAID('OUIA-Generated-Table').should('be.visible');
      // cy.get(`[data-test-rows="resource-row"`).should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.log('listPage.ARRows.countShouldBe');
      cy.byClass('pf-v6-c-table__tbody').should('have.length', count);
      // cy.get(`[data-test-rows="resource-row"`).should('have.length', count);
    },
    ARShouldBe: (alert: string, severity: string, total: number, state: string) => {
      cy.log('listPage.ARRows.ARShouldBe');
      cy.byOUIAID('OUIA-Generated-Button-plain').should('exist');
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR');
      cy.byClass('pf-v6-c-table__td').contains(alert).should('exist');
      cy.byClass('pf-v6-c-label__text').contains(severity).should('exist');
      cy.byClass('pf-v6-c-badge pf-m-read').contains(total).should('exist');
      cy.byClass('pf-v6-c-table__td').contains(state).should('exist');
    },
    AShouldBe: (alert: string, severity: string, namespace: string) => {
      cy.log('listPage.ARRows.AShouldBe');
      cy.byClass('co-m-resource-icon co-m-resource-alert').should('exist');
      cy.byClass('pf-v6-l-flex pf-m-space-items-none pf-m-nowrap').contains(alert).should('exist');
      cy.byClass('pf-v6-c-label__text').contains(severity).should('exist');
      cy.byClass('co-resource-item__resource-name').contains(namespace).should('exist');
    },
    expandRow: () => {
      cy.log('listPage.ARRows.expandRow');
      try {
        cy.get('body').then(($provider) => {
          if ($provider.find('button[class="pf-v6-c-button pf-m-plain pf-m-expanded"]').length > 0) {
            cy.log('Already expanded');
          } else {
            cy.get('button[class="pf-v6-c-button pf-m-plain"]', { timeout: 10000 })
              .eq(2)
              .click();
          }
        })
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    clickAlertingRule: () => {
      cy.log('listPage.ARRows.clickAlertingRule');
      try {
        cy.byClass('co-m-resource-icon co-m-resource-alertrule')
          .contains('AR')
          .parent()
          .next()
          .should('be.visible')
          .click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }

    },
    clickAlert: () => {
      cy.log('listPage.ARRows.clickAlert');
      try {
        cy.get('[class="co-m-resource-icon co-m-resource-alert"]')
          .parent()
          .next('div')
          .click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }

    },
    assertNoKebab: () => {
      cy.log('listPage.ARRows.assertNoKebab');
      try {
        cy.byLegacyTestID('kebab-button').should('not.exist');
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    clickAlertKebab: () => {
      cy.log('listPage.ARRows.clickAlertKebab');
      try {
        cy.byLegacyTestID('kebab-button').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    silenceAlert: () => {
      cy.log('listPage.ARRows.silentAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byClass('pf-v6-c-menu__item-text').contains('Silence alert').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }


    },
    editAlert: () => {
      cy.log('listPage.ARRows.editAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byClass('pf-v6-c-menu__item-text').contains('Edit alert').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    expireAlert: (yes: boolean) => {
      cy.log('listPage.ARRows.expireAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byClass('pf-v6-c-menu__item-text').contains('Expire alert').should('be.visible').click();
        commonPages.confirmExpireAlert(yes);
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
  },
};
