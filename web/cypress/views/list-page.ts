import { DataTestIDs, Classes, LegacyTestIDs, FilterOUIAIDs } from '../../src/components/data-test';

export const listPage = {
  /**
   *
   * @param tab
   */
  tabShouldHaveText: (tab: string) => {
    cy.log('listPage.tabShouldHaveText');
    cy.get(Classes.HorizontalNav).contains(tab).should('exist');
  },

  /**
   *
   * @param clearFolder true = clear folder, false = do not clear folder
   * @param fileNameExp i.e openshift.csv
   */
  exportAsCSV: (clearFolder: boolean, fileNameExp: RegExp) => {
    cy.log('listPage.exportAsCSV');
    let downloadedFileName: string | null = null;
    const downloadsFolder = Cypress.config('downloadsFolder');
    const expectedFileNamePattern = fileNameExp;
    if (clearFolder) {
      cy.task('clearDownloads');
    }
    cy.byTestID(DataTestIDs.DownloadCSVButton).should('be.visible').click();

    cy.waitUntil(
      () => {
        return cy.task('getFilesInFolder', downloadsFolder).then((currentFiles: string[]) => {
          const matchingFile = currentFiles.find((file) => expectedFileNamePattern.test(file));
          if (matchingFile) {
            downloadedFileName = matchingFile;
            return true;
          }
          return false;
        });
      },
      {
        timeout: 20000,
        interval: 1000,
        errorMsg: [
          `CSV file matching "${expectedFileNamePattern}"`,
          'was not downloaded within timeout.',
        ].join(' '),
      },
    );

    cy.then(() => {
      expect(downloadedFileName).to.not.equal(null);
      cy.task('doesFileExist', { fileName: downloadedFileName }).should('be.true');
    });
  },

  filter: {
    selectAttribute: (attributeName: string) => {
      cy.log('listPage.filter.selectAttribute');
      cy.byOUIAID('DataViewFilters').scrollIntoView();
      cy.byOUIAID('DataViewFilters')
        .find('.pf-v6-c-menu-toggle')
        .first()
        .then(($toggle) => {
          if (!$toggle.text().includes(attributeName)) {
            cy.wrap($toggle).click();
            cy.get('.pf-v6-c-menu__item').contains(attributeName).click();
          }
        });
    },

    /**
     * @param name
     */
    byName: (name: string, ouiaId: string = FilterOUIAIDs.AlertNameFilter) => {
      cy.log('listPage.filter.byName');
      try {
        listPage.filter.selectAttribute('Name');
        cy.byOUIAID(`${ouiaId}-input`)
          .find('input')
          .scrollIntoView()
          .as('input')
          .should('be.visible');
        cy.get('@input', { timeout: 10000 })
          .scrollIntoView()
          .type(name + '{enter}');
        cy.get('@input', { timeout: 10000 }).scrollIntoView().should('have.attr', 'value', name);
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    /**
     * @param label
     */
    byLabel: (label: string) => {
      cy.log('listPage.filter.byLabel');
      listPage.filter.selectAttribute('Label');
      cy.byLegacyTestID(LegacyTestIDs.ItemFilter).scrollIntoView().as('input').should('be.visible');
      cy.get('@input', { timeout: 10000 })
        .scrollIntoView()
        .type(label + '{enter}')
        .should('have.attr', 'value', label);
      cy.byTestID(DataTestIDs.LabelSuggestion).contains(label).click();
    },

    clearAllFilters: () => {
      cy.log('listPage.filter.clearAllFilters');
      try {
        cy.byOUIAID('DataViewFilters').scrollIntoView();
        cy.byOUIAID('DataViewToolbar-clear-all-filters').first().click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },

    /**
     * Select a filter option from a checkbox filter.
     * First selects the filter attribute, then opens the checkbox dropdown and clicks the option.
     *
     * @param filterCategory The filter attribute name
     * ie. 'Alert State', 'Severity', 'Source', 'Silence State'
     * @param option The option value to select (e.g., 'Firing', 'Critical', 'Platform')
     */
    selectFilterOption: (filterCategory: string, option: string) => {
      cy.log('listPage.filter.selectFilterOption');
      listPage.filter.selectAttribute(filterCategory);
      cy.byOUIAID('DataViewFilters').scrollIntoView();
      cy.byOUIAID('DataViewFilters')
        .find(Classes.FilterDropdown)
        .filter(':visible')
        .last()
        .scrollIntoView()
        .click();
      cy.get(Classes.FilterDropdownOption).contains(option).should('be.visible').click();
      cy.byOUIAID('DataViewFilters').scrollIntoView();
      cy.byOUIAID('DataViewFilters')
        .find(Classes.FilterDropdown)
        .filter(':visible')
        .last()
        .scrollIntoView()
        .click();
    },

    /**
     *
     * @param tagName alerts-tab: Firing, Pending, Silenced, Critical, Warning, Info, None,
     *   Platform, User
     *   silences: Active, Pending, Expired
     *   alerting-rules: Firing, Pending, Silenced, Not Firing, Critical, Warning, Info, None,
     *   Platform, User
     */
    removeIndividualTag: (tagName: string) => {
      cy.log('listPage.filter.removeIndividualTag');
      cy.byOUIAID('DataViewFilters').scrollIntoView();
      cy.get(Classes.IndividualTag)
        .contains(new RegExp(`^${tagName}$`))
        .parent()
        .next('span')
        .children('button')
        .click();
    },

    /**
     *
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State,
     *   alerting-rules (Alert State, Severity, Source)
     */
    clickOn1more: (groupTagName: string) => {
      cy.log('listPage.filter.clickOn1more');
      cy.byOUIAID('DataViewFilters').scrollIntoView();
      cy.get(Classes.MoreLessTag)
        .contains(groupTagName)
        .siblings('ul')
        .children('li')
        .contains('1 more')
        .click();
    },

    /**
     *
     * @param groupTagName alerts-tab (Alert State, Severity, Source), Silence State,
     *   alerting-rules (Alert State, Severity, Source)
     */
    clickOnShowLess: (groupTagName: string) => {
      cy.log('listPage.filter.clickOnShowLess');
      cy.byOUIAID('DataViewFilters').scrollIntoView();
      cy.get(Classes.MoreLessTag)
        .contains(groupTagName)
        .siblings('ul')
        .children('li')
        .contains('Show Less')
        .click();
    },
  },
  ARRows: {
    shouldBeLoaded: () => {
      cy.log('listPage.ARRows.shouldBeLoaded');
      cy.byOUIAID(DataTestIDs.Table).should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.log('listPage.ARRows.countShouldBe');
      cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).should('have.length', count);
    },

    //pf-6 only
    ARShouldBe: (alert: string, severity: string, total: number, state: string) => {
      cy.log('listPage.ARRows.ARShouldBe');
      cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).contains('AR');
      cy.byTestID(DataTestIDs.AlertingRuleResourceLink).contains(alert).should('exist');
      cy.byTestID(DataTestIDs.AlertingRuleSeverityBadge).contains(severity).should('exist');
      cy.byTestID(DataTestIDs.AlertingRuleTotalAlertsBadge).contains(total).should('exist');
      cy.byTestID(DataTestIDs.AlertingRuleStateBadge).contains(state).should('exist');
    },
    AShouldBe: (alert: string, severity: string, namespace: string) => {
      cy.log('listPage.ARRows.AShouldBe');
      cy.byTestID(DataTestIDs.AlertResourceIcon).should('exist');
      cy.byTestID(DataTestIDs.AlertResourceLink).contains(alert).should('exist');
      cy.byTestID(DataTestIDs.SeverityBadge).contains(severity).should('exist');
      cy.byTestID(DataTestIDs.AlertNamespace).contains(namespace).should('exist');
    },
    //pf-6 only
    expandRow: () => {
      cy.log('listPage.ARRows.expandRow');
      try {
        cy.get('body').then(($provider) => {
          if ($provider.find(Classes.ExpandedRow).length > 0) {
            cy.log('Already expanded');
          } else {
            cy.byTestID(DataTestIDs.AlertingRuleArrow).first().find('button').click();
          }
        });
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    //pf-6 only
    clickAlertingRule: () => {
      cy.log('listPage.ARRows.clickAlertingRule');
      try {
        cy.byTestID(DataTestIDs.AlertingRuleResourceLink).should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    clickAlert: () => {
      cy.log('listPage.ARRows.clickAlert');
      try {
        cy.byTestID(DataTestIDs.AlertResourceLink).should('be.visible').click();
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
        cy.byTestID(DataTestIDs.KebabDropdownButton).should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
    silenceAlert: () => {
      cy.log('listPage.ARRows.silentAlert');
      try {
        listPage.ARRows.clickAlertKebab();
        cy.byTestID(DataTestIDs.SilenceAlertDropdownItem).should('be.visible').click();
      } catch (error) {
        cy.log(`${error.message}`);
        throw error;
      }
    },
  },
  emptyState: () => {
    cy.log('listPage.emptyState');
    cy.byTestID(DataTestIDs.EmptyBoxBody).contains('No alerts found').should('be.visible');
    cy.byOUIAID('DataViewToolbar-clear-all-filters').should('not.be.visible');
    cy.byTestID(DataTestIDs.DownloadCSVButton).should('not.exist');
    cy.byOUIAID(DataTestIDs.Table).should('not.exist');
  },
};
