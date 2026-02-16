import { detailsPage } from "./details-page";
import { DataTestIDs, Classes } from "../../src/components/data-test";

export const commonPages = {
  projectDropdownShouldNotExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('not.exist'),
  projectDropdownShouldExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('exist'),
  titleShouldHaveText: (title: string) => {
    cy.log('commonPages.titleShouldHaveText - ' + `${title}`);
    cy.bySemanticElement('h1', title).scrollIntoView().should('be.visible');
  },

  linkShouldExist: (linkName: string) => {
    cy.log('commonPages.linkShouldExist - ' + `${linkName}`);
    cy.bySemanticElement('button', linkName).should('be.visible');

  },
  clickBellIcon: () => {
    cy.log('commonPages.clickBellIcon');
    cy.byAriaLabel('Notification drawer').should('be.visible').click();

  },

  bellIconClickAlert: (alert: string) => {
    cy.log('commonPages.bellIconClickAlert');
    cy
      .get('pf-v6-c-notification-drawer__list-item-header, .pf-v5-c-notification-drawer__list-item-header')
      .contains(alert)
      .click();
  },

  confirmExpireAlert: (yes: boolean) => {
    cy.log('commonPages.confirmExpireAlert');
    cy.byPFRole('dialog').should('be.visible');

    if (yes) {
      cy.bySemanticElement('button', 'Expire silence').should('be.visible').click({force: true});
    } else {
      cy.bySemanticElement('button', 'Cancel').should('be.visible').click({force: true});
    };
  },

  detailsPage: {
    alert: (alert: string) => {
      cy.log('commonPages.detailsPage.alert');
      cy.get(Classes.AlertDetailsAlertResourceIcon).contains('AL');
      cy.bySemanticElement('button').contains('Silence alert').should('be.visible');
      detailsPage.sectionHeaderShouldExist('Alert details');
      cy.byTestID(DataTestIDs.AlertRulesDetailResourceLink).scrollIntoView();
      cy.get(Classes.AlertRulesDetailResourceIcon).contains('AR').should('be.visible');
      cy.byTestID(DataTestIDs.AlertRulesDetailResourceLink).contains(alert).should('be.visible');

    },
    alertRule: () => {
      cy.log('commonPages.detailsPage.alertRule');
      cy.get(Classes.AlertingRuleDetailsResourceIcon).contains('AR').should('be.visible');
      cy.get(Classes.Expression).should('be.visible');
      cy.byTestID(DataTestIDs.AlertingRuleDetailsResourceLink).scrollIntoView();
      cy.byTestID(DataTestIDs.AlertingRuleDetailsResourceLink).should('have.length.at.least', 1);
    },
    common: (alert: string, severity: string) => {
      cy.wait(3000);
      cy.log('commonPages.detailsPage.common');
      commonPages.titleShouldHaveText(alert);
      cy.byTestID(DataTestIDs.SeverityBadgeHeader).contains(severity).should('be.visible');
      cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
      cy.bySemanticElement('button').contains('Reset zoom').should('be.visible');
      cy.byAriaLabel('View in Metrics').should('be.visible');
    },
    administration_clusterSettings: () => {
      cy.log('commonPages.detailsPage.administration_clusterSettings');
      cy.byLegacyTestID('horizontal-link-Configuration').should('be.visible').click();
      cy.byLegacyTestID('item-filter', { timeout: 250000 }).should('be.visible').type('Alertmanager')
      cy.bySemanticElement('a').contains('Alertmanager').should('be.visible').click();
      cy.bySemanticElement('button').contains('Create Receiver').should('be.visible');
    },
  }

}