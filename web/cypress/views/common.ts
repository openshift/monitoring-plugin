import { detailsPage } from "./details-page";
import { nav } from "./nav";
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
      cy.byTestID(DataTestIDs.ExpireSilenceButton).should('be.visible').click({force: true});
    } else {
      cy.byTestID(DataTestIDs.CancelButton).should('be.visible').click({force: true});
    };
    cy.byTestID(DataTestIDs.ExpireSilenceButton).should('not.exist');
  },

  detailsPage: {
    alert: (alert: string) => {
      cy.log('commonPages.detailsPage.alert');
      cy.byTestID(DataTestIDs.AlertResourceIcon).contains('A');
      cy.byTestID(DataTestIDs.SilenceButton).should('be.visible');
      detailsPage.sectionHeaderShouldExist('Alert details');
      cy.byTestID(DataTestIDs.AlertingRuleResourceLink).scrollIntoView();
      cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).contains('AR').should('be.visible');
      cy.byTestID(DataTestIDs.AlertingRuleResourceLink).contains(alert).should('be.visible');

    },
    alertRule: () => {
      cy.log('commonPages.detailsPage.alertRule');
      cy.byTestID(DataTestIDs.AlertingRuleResourceIcon).contains('AR').should('be.visible');
      cy.byTestID(DataTestIDs.Expression).should('be.visible');
      cy.byTestID(DataTestIDs.AlertResourceLink).scrollIntoView();
      cy.byTestID(DataTestIDs.AlertResourceLink).should('have.length.at.least', 1);
    },
    common: (alert: string, severity: string) => {
      cy.log('commonPages.detailsPage.common');
      commonPages.titleShouldHaveText(alert);
      cy.byTestID(DataTestIDs.MetricHideShowGraphButton).contains('Hide graph').should('be.visible');
      cy.byTestID(DataTestIDs.MetricGraph).should('be.visible');
      cy.byTestID(DataTestIDs.MetricResetZoomButton).should('be.visible');
      cy.byAriaLabel('Inspect').should('be.visible'); //pf-5 cy.byAriaLabel('View in Metrics').should('be.visible').click(); 
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