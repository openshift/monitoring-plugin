import { detailsPage } from "./details-page";
import { nav } from "./nav";

export const commonPages = {
  projectDropdownShouldNotExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('not.exist'),
  projectDropdownShouldExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('exist'),
  titleShouldHaveText: (title: string) => {
    cy.log('commonPages.titleShouldHaveText - ' + `${title}`);
    cy.bySemanticElement('h1', title).should('be.visible');
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
      cy.byPFRole('dialog').find('button').contains('Expire silence').should('be.visible').click();
    } else {
      cy.byPFRole('dialog').find('button').contains('Cancel').should('be.visible').click();
    };
    cy.byPFRole('dialog').find('button').contains('Expire silence').should('not.exist');
  },

  detailsPage: {
    alert: (alert: string) => {
      cy.log('commonPages.detailsPage.alert');
      cy.get('.co-m-resource-icon.co-m-resource-alert, .co-m-resource-icon.co-m-resource-alert.co-m-resource-icon--lg').contains('A').should('be.visible');
      cy.byOUIAID('OUIA-Generated-Button-primary').contains('Silence alert').should('be.visible');
      detailsPage.sectionHeaderShouldExist('Alert details');
      cy.byTestID('alert-rules-detail-resource-link').scrollIntoView();
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR').should('be.visible');
      cy.byTestID('alert-rules-detail-resource-link').contains(alert).should('be.visible');

    },
    alertRule: () => {
      cy.log('commonPages.detailsPage.alertRule');
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR').should('be.visible');
      cy.get('.pf-v6-c-code-block__content, .pf-v5-c-code-block__content').should('be.visible');
      cy.byTestID('active-alerts').scrollIntoView();
      cy.byTestID('active-alerts').should('have.length.at.least', 1);
    },
    common: (alert: string, severity: string) => {
      cy.log('commonPages.detailsPage.common');
      commonPages.titleShouldHaveText(alert);
      cy.bySemanticElement('button').contains('Hide graph').should('be.visible');
      cy.get('.pf-v6-c-card.pf-m-compact, .query-browser__controls').should('be.visible');
      cy.bySemanticElement('button').contains('Reset zoom').should('be.visible');
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