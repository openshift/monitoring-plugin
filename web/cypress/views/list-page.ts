import { commonPages } from "./common";
import { getPFVersion } from "./utils";

export const listPage = {

  /**
   * 
   * @param tab
   */
  tabShouldHaveText: (tab: string) => {
    cy.log('listPage.tabShouldHaveText');
    cy
      .byClass('pf-v6-c-tabs__item-text')
      .contains(tab)
      .should('exist');
  },

  /**
   * 
   * @param clearFolder true = clear folder, false = do not clear folder
   * @param fileNameExp i.e openshift.csv
   * @param alertName 
   * @param severity 
   * @param state 
   * @param total 
   */
  exportAsCSV: (clearFolder: boolean, fileNameExp: RegExp, alertName: string, severity: string, state: string, total: number) => {
    cy.log('listPage.exportAsCSV');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
    if (clearFolder) {
      cy.task('clearDownloads');
    }
    cy.bySemanticElement('button', 'Export as CSV').should('be.visible').click();

    cy.waitUntil(() => {
      return cy.task('getFilesInFolder', downloadsFolder).then((currentFiles: string[]) => {
        const matchingFile = currentFiles.find(file => expectedFileNamePattern.test(file));
        if (matchingFile) {
          downloadedFileName = matchingFile;
          return true;
        }
        return false;
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
     * @param name 
     */
    byName: (name: string) => {
      cy.log('listPage.filter.byName');
      try {
          cy.byLegacyTestID('dropdown-button').scrollIntoView().click();
          cy.byLegacyTestID('dropdown-menu').contains('Name').click();
          cy.byTestID('name-filter-input').scrollIntoView().as('input').should('be.visible');
          cy.get('@input', { timeout: 10000 }).scrollIntoView().type(name + '{enter}');
          cy.get('@input', { timeout: 10000 }).scrollIntoView().should('have.attr', 'value', name);
        
      }
      catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    /**
     * @param label 
     */
    byLabel: (label: string) => {
      cy.log('listPage.filter.byLabel');
      cy.byLegacyTestID('dropdown-button').scrollIntoView().click();
      cy.byLegacyTestID('dropdown-menu').contains('Label').click();
      cy.byLegacyTestID('item-filter').scrollIntoView()
        .as('input').should('be.visible');
      cy.get('@input', { timeout: 10000 }).scrollIntoView().type(label + '{enter}').should('have.attr', 'value', label);
      cy.byTestID('suggestion-line').contains(label).click();
    },
    
    clearAllFilters: () => {
      cy.log('listPage.filter.clearAllFilters');
      try {
        cy.bySemanticElement('button', 'Clear all filters').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },

    /**
     * 
     * @param toOpen true = open, false = nothing
     * @param toClose true = close, false = nothing
     */
    clickFilter: (toOpen: boolean, toClose: boolean) => {
      cy.log('listPage.filter.clickFilter');
      if (toOpen) {
        cy.get('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle').contains('Filter').scrollIntoView().should('be.visible').click();
      }
      if (toClose) {
        cy.get('.pf-v6-c-menu-toggle.pf-m-expanded, .pf-v5-c-menu-toggle.pf-m-expanded').contains('Filter').should('be.visible').click();
      }
    },

    /**
     * 
     * @param open true = open, false = nothing
     * @param option i.e. Firing
     * @param close true = close, false = nothing
     */
    selectFilterOption: (open: boolean, option: string, close: boolean) => {
      cy.log('listPage.filter.selectFilterOption');
      if (open) {
        listPage.filter.clickFilter(open, false);
      };
      cy.byPFRole('menuitem').contains(option).should('be.visible').click();
      if (close) {
        listPage.filter.clickFilter(false, close);
      };
    },

    /**
     *  Click on the X for the whole tag group
     * @param groupTagName 
     */
    removeMainTag: (groupTagName: string) => {
      cy.log('listPage.filter.removeMainTag');
      cy.get(".pf-v6-c-label-group__label, .pf-v5-c-chip-group__label").contains(groupTagName).parent().next('div').children('button').click();
    },

    /**
     * 
     * @param tagName alerts-tab: Firing, Pending, Silenced, Critical, Warning, Info, None, Platform, User
     *                silences: Active, Pending, Expired
     *                alerting-rules: Firing, Pending, Silenced, Not Firing, Critical, Warning, Info, None, Platform, User
     */
    removeIndividualTag: (tagName: string) => {
      cy.log('listPage.filter.removeIndividualTag');
      cy.get('.pf-v6-c-label__text, .pf-v5-c-chip__text').contains(tagName).parent().next('span').children('button').click();
    },

    /**
     * 
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State, alerting-rules (Alert State, Severity, Source)
     */
    clickOn1more: (groupTagName: string) => {
      cy.log('listPage.filter.clickOn1more');
      cy.get('.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label').contains(groupTagName).siblings('ul').children('li').contains('1 more').click();

    },

    /**
     * 
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State, alerting-rules (Alert State, Severity, Source)
     */
    clickOnShowLess: (groupTagName: string) => {
      cy.log('listPage.filter.clickOnShowLess');
      cy.get('.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label').contains(groupTagName).siblings('ul').children('li').contains('Show less').click();

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
      cy.get('.co-m-resource-icon.co-m-resource-alertrule').should('have.length', count);
    },
    
    //pf-6 only
    ARShouldBe: (alert: string, severity: string, total: number, state: string) => {
      cy.log('listPage.ARRows.ARShouldBe');
      if (getPFVersion() === 'v6') {
        cy.byOUIAID('OUIA-Generated-Button-plain').should('exist');
        cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR');
        cy.byClass('pf-v6-c-table__td').contains(alert).should('exist');
        cy.byClass('pf-v6-c-label__text').contains(severity).should('exist');
        cy.byClass('pf-v6-c-badge pf-m-read').contains(total).should('exist');
        cy.byClass('pf-v6-c-table__td').contains(state).should('exist');
      }
    
    },
    AShouldBe: (alert: string, severity: string, namespace: string) => {
      cy.log('listPage.ARRows.AShouldBe');
      cy.byClass('co-m-resource-icon co-m-resource-alert').should('exist');
      cy.byLegacyTestID('alert-resource-link').contains(alert).should('exist');
      cy.get('.pf-v6-c-label__text, .pf-m-hidden.pf-m-visible-on-sm').contains(severity).should('exist');
      cy.byClass('co-resource-item__resource-name').contains(namespace).should('exist'); //pf-6 only
      
    },
    //pf-6 only
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
    //pf-6 only
    clickAlertingRule: () => {
      cy.log('listPage.ARRows.clickAlertingRule');
      try {
        cy.byLegacyTestID('alert-resource-link').eq(0)
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
        cy.byLegacyTestID('alert-resource-link').eq(1)
          .should('be.visible')
          .click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }

    },
    assertNoKebab: () => {
      cy.log('listPage.ARRows.assertNoKebab');
      try {
        cy.byAriaLabel('toggle menu').should('not.exist');
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    clickAlertKebab: () => {
      cy.log('listPage.ARRows.clickAlertKebab');
      try {
        cy.byAriaLabel('toggle menu').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    silenceAlert: () => {
      cy.log('listPage.ARRows.silentAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byPFRole('menuitem').contains('Silence alert').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }


    },
    editAlert: () => {
      cy.log('listPage.ARRows.editAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byPFRole('menuitem').contains('Edit alert').should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    expireAlert: (yes: boolean) => {
      cy.log('listPage.ARRows.expireAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byPFRole('menuitem').contains('Expire alert').should('be.visible').click();
        commonPages.confirmExpireAlert(yes);
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
  },
};
