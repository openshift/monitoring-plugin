export const getEditorContent = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.window().then((win: any) => win.monaco.editor.getModels()[0].getValue());

export const setEditorContent = (text: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.window().then((win: any) => win.monaco.editor.getModels()[0].setValue(text));

// Initially yamlEditor loads with all grey text, finished loading when editor is color coded
// class='mtk26' is the light blue color of property such as 'apiVersion'
export const isLoaded = () => cy.get("[class='mtk26']").should('exist');
// Since yaml editor class mtk26 is a font class it doesn't work on an import page with no text
// Checking the first line number and waiting allows the full component to load.
export const isImportLoaded = () => {
  cy.wait(5000);
  cy.get('.monaco-editor textarea:first').should('exist');
};
export const clickSaveCreateButton = () => cy.byTestID('save-changes').click();
export const clickCancelButton = () => cy.byTestID('cancel').click();
export const clickReloadButton = () => cy.byTestID('reload-object').click();

export const listPage = {
  titleShouldHaveText: (title: string) =>
    cy.byLegacyTestID('resource-title').contains(title).should('exist'),
  clickCreateYAMLdropdownButton: () => {
    cy.byTestID('item-create')
      .click()
      .get('body')
      .then(($body) => {
        if ($body.find(`[data-test-dropdown-menu="yaml"]`).length) {
          cy.get(`[data-test-dropdown-menu="yaml"]`).click();
        }
      });
  },
  isCreateButtonVisible: () => {
    cy.byTestID('item-create').should('be.visible');
  },
  clickCreateYAMLbutton: () => {
    cy.byTestID('item-create').click({ force: true });
  },
  createNamespacedResourceWithDefaultYAML: (resourceType: string, testName: string) => {
    cy.visit(`/k8s/ns/${testName}/${resourceType}`);
    listPage.clickCreateYAMLbutton();
    cy.byTestID('resource-sidebar').should('exist');
    isLoaded();
    clickSaveCreateButton();
  },
  filter: {
    byName: (name: string) => {
      cy.byTestID('name-filter-input').clear().type(name);
    },
    clickSearchByDropdown: () => {
      cy.byTestID('filter-toolbar').within(() => {
        cy.byLegacyTestID('dropdown-button').click();
      });
    },
    clickFilterDropdown: () => {
      cy.byLegacyTestID('filter-dropdown-toggle').within(() => {
        cy.get('button').click();
      });
    },
    by: (rowFilter: string) => {
      cy.byTestID('filter-toolbar').within(() => {
        cy.byLegacyTestID('filter-dropdown-toggle')
          .find('button')
          .as('filterDropdownToggleButton')
          .click();
        /* PF Filter dropdown menu items are:
           <li id="cluster">
             <a data-test-row-filter="cluster">
         */
        cy.get(`#${rowFilter}`).click({ force: true }); // Clicking on the <li /> works!
        cy.url().should('include', '?rowFilter');
        cy.get('@filterDropdownToggleButton').click();
      });
    },
  },
  rows: {
    shouldBeLoaded: () => {
      cy.get('[data-test-rows="resource-row"]').should('be.visible');
    },
    countShouldBe: (count: number) => {
      cy.get('[data-test-rows="resource-row"]').should('have.length', count);
    },
    countShouldBeWithin: (min: number, max: number) => {
      cy.get('[data-test-rows="resource-row"]').should('have.length.within', min, max);
    },
    clickFirstLinkInFirstRow: () => {
      // Row filters can detach resource rows from the DOM, requiring a forced click.
      cy.get('[data-test-rows="resource-row"]').first().find('a').first().click({ force: true });
    },
    clickKebabAction: (resourceName: string, actionName: string) => {
      cy.get('[data-test-rows="resource-row"]')
        .contains(resourceName)
        .parents('tr')
        .within(() => {
          cy.get('[data-test-id="kebab-button"]').click();
        });
      cy.byTestActionID(actionName).click();
    },
    clickStatusButton: (resourceName: string) => {
      cy.get('[data-test-rows="resource-row"]')
        .contains(resourceName)
        .parents('tr')
        .within(() => {
          cy.byTestID('popover-status-button').click();
        });
    },
    hasLabel: (resourceName: string, label: string) => {
      cy.get('[data-test-rows="resource-row"]')
        .contains(resourceName)
        .byTestID('label-list')
        .contains(label);
    },
    shouldExist: (resourceName: string) =>
      cy.get('[data-test-rows="resource-row"]').contains(resourceName),
    // Row filters can detach resource rows from the DOM, requiring a forced click.
    clickRowByName: (resourceName: string) =>
      cy.get(`a[data-test-id="${resourceName}"]`).click({ force: true }),
    shouldNotExist: (resourceName: string) =>
      cy.get(`[data-test-id="${resourceName}"]`, { timeout: 90000 }).should('not.exist'),
  },
};

export const pages = {
  goToPodDetails: (ns, podName) => {
    pages.goToPodsList(ns);
    listPage.filter.byName(podName);
    listPage.rows.countShouldBeWithin(1, 4);
    listPage.rows.clickFirstLinkInFirstRow();
  },
  goToPodsList: (ns: string | null = null) => {
    cy.visit(ns ? `/k8s/ns/${ns}/pods` : '/k8s/all-namespaces/pods');
    listPage.rows.shouldBeLoaded();
  },
};

// Keep Pages for backward compatibility
export const Pages = {
  gotoPodsList: () => {
    cy.visit('/k8s/all-namespaces/core~v1~Pod');
    listPage.rows.shouldBeLoaded();
  },
};
