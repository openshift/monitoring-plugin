import { Classes, IDs, persesAriaLabels } from "../../src/components/data-test";
import { persesCreateDashboard, persesDashboardsImportDashboard, persesDashboardsModalTitles } from "../fixtures/perses/constants";

export const persesImportDashboardsPage = {

  importDashboardShouldBeLoaded: () => {
    cy.log('persesImportDashboardsPage.importDashboardShouldBeLoaded');
    cy.wait(2000);
    cy.byPFRole('dialog').find('h1').should('have.text', persesDashboardsModalTitles.IMPORT_DASHBOARD);
    cy.bySemanticElement('label').contains(persesDashboardsImportDashboard.DIALOG_TITLE).should('be.visible');
    cy.bySemanticElement('span').contains(persesDashboardsImportDashboard.DIALOG_UPLOAD_JSON_YAML_FILE).should('be.visible');
    cy.get('#' + IDs.persesDashboardImportDashboardUploadFileInput).should('be.visible');
    cy.byPFRole('dialog').find('button').contains('Upload').should('be.visible');
    cy.byPFRole('dialog').find('button').contains('Clear').should('be.visible');
    cy.byPFRole('dialog').find('button').contains('Import').should('be.visible');
    cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible');
  },

  uploadFile: (file: string) => {
    cy.log('persesImportDashboardsPage.uploadFile');
    // Normalize path separators for cross-platform compatibility (Mac/Linux/Windows)
    const normalizedPath = file.replace(/\\/g, '/');
    
    cy.readFile(normalizedPath).then((content) => {
      const textContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
      
      // Monaco editor requires special handling - click to focus, then set value via Monaco API
      cy.get(Classes.ImportDashboardTextArea).should('be.visible').click({ force: true });
      
      cy.window().then((win) => {
        const models = (win as any).monaco?.editor?.getModels?.();
        if (Array.isArray(models) && models.length > 0) {
          models[0].setValue(textContent);
        } else {
          cy.get(Classes.ImportDashboardTextArea).clear().type(textContent);
        }
      });
    });
    cy.wait(2000);
  },

  clickClearFileButton: () => {
    cy.log('persesImportDashboardsPage.clearFile');
    cy.byPFRole('dialog').find('button').contains('Clear').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  clickImportFileButton: () => {
    cy.log('persesImportDashboardsPage.clickImportFileButton');
    cy.byPFRole('dialog').find('button').contains('Import').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  clickCancelButton: () => {
    cy.log('persesImportDashboardsPage.clickCancelButton');
    cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible').click({ force: true });
    cy.wait(2000);
  },

  assertUnableToDetectDashboardFormat: () => {
    cy.log('persesImportDashboardsPage.assertUnableToDetectDashboardFormat');
    cy.byPFRole('dialog').find('span').contains(persesDashboardsImportDashboard.DIALOG_UNABLE_TO_DETECT_DASHBOARD_FORMAT).should('be.visible');
  },

  assertGrafanaDashboardDetected: () => {
    cy.log('persesImportDashboardsPage.assertGrafanaDashboardDetected');
    cy.byPFRole('dialog').find('span').contains(persesDashboardsImportDashboard.DIALOG_GRAFANA_DASHBOARD_DETECTED).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.dialogProjectInput).should('be.visible');
  },

  assertPersesDashboardDetected: () => {
    cy.log('persesImportDashboardsPage.assertPersesDashboardDetected');
    cy.byPFRole('dialog').find('span').contains(persesDashboardsImportDashboard.DIALOG_PERSES_DASHBOARD_DETECTED).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.dialogProjectInput).should('be.visible');
  },

  selectProject: (project: string) => {
    cy.log('persesImportDashboardsPage.selectProject');
    cy.byAriaLabel(persesAriaLabels.importDashboardProjectInputButton).should('be.visible').click({ force: true });
    cy.byAriaLabel(persesAriaLabels.dialogProjectInput).clear().type(project);
    cy.byPFRole('option').contains(project).should('be.visible').click({ force: true });
  },
  
  assertProjectDropdown: (project: string) => {
    cy.log('persesImportDashboardsPage.assertProjectDropdown');
    cy.byAriaLabel(persesAriaLabels.importDashboardProjectInputButton).should('be.visible').click({ force: true });
    cy.byAriaLabel(persesAriaLabels.dialogProjectInput).clear().type(project);
    cy.byPFRole('option').contains(project).should('be.visible');
    cy.byAriaLabel(persesAriaLabels.importDashboardProjectInputButton).should('be.visible').click({ force: true });
  },

  assertProjectNotExistsInDropdown: (project: string) => {
    cy.log('persesImportDashboardsPage.assertProjectNotExistsInDropdown');
    cy.byAriaLabel(persesAriaLabels.importDashboardProjectInputButton).should('be.visible').click({ force: true });
    cy.byPFRole('listbox').find('li').each(($item) => {
      expect($item.text().trim()).to.not.equal(project);
    });
    cy.byAriaLabel(persesAriaLabels.importDashboardProjectInputButton).should('be.visible').click({ force: true });
  },

  assertFailedToMigrateGrafanaDashboard: () => {
    cy.log('persesImportDashboardsPage.assertFailedToMigrateGrafanaDashboard');
    cy.byPFRole('dialog').find('h4').contains(persesDashboardsImportDashboard.DIALOG_FAILED_TO_MIGRATE_GRAFANA_DASHBOARD).should('be.visible');
  },

  assertDuplicatedDashboardError: () => {
    cy.log('persesImportDashboardsPage.assertDuplicatedDashboardError');
    cy.byPFRole('dialog').find('h4').contains(persesDashboardsImportDashboard.DIALOG_DUPLICATED_DASHBOARD_ERROR).should('be.visible');
  },

  dismissDuplicatedDashboardError: () => {
    cy.log('persesImportDashboardsPage.dismissDuplicatedDashboardError');
    cy.byAriaLabel(persesAriaLabels.importDashboardDuplicatedDashboardError).scrollIntoView().should('be.visible').click({ force: true });
    cy.wait(2000);
  },

}
