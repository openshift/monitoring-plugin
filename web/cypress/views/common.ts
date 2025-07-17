import { detailsPage } from "./details-page";

export const commonPages = {
  projectDropdownShouldNotExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('not.exist'),
  projectDropdownShouldExist: () => cy.byLegacyTestID('namespace-bar-dropdown').should('exist'),
  titleShouldHaveText: (title: string) => {
    cy.log('commonPages.titleShouldHaveText - ' + `${title}`);
    cy
      .byClass('pf-v6-c-title pf-m-h1')
      .contains(title)
      .should('be.visible');
  },
  //Targets page
  cmo_titleShouldHaveText: (title: string) => {
    cy.log('commonPages.cmo_titleShouldHaveText - ' + `${title}`);
    cy
      .byClass('pf-v6-c-content--h1')
      .contains(title)
      .should('exist');
  },
  linkShouldExist: (linkName: string) => {
    cy.log('commonPages.linkShouldExist - ' + `${linkName}`);
    cy
      .byClass('pf-v6-c-button__text')
      .contains(linkName)
      .should('exist');
  },
  clickBellIcon: () => {
    cy.log('commonPages.clickBellIcon');
    cy
      .byClass('pf-v6-c-button pf-m-stateful pf-m-plain co-masthead-button')
      .click();
  },

  bellIconClickAlert: (alert: string) => {
    cy.log('commonPages.bellIconClickAlert');
    cy
      .byClass('pf-v6-c-notification-drawer__list-item-header')
      .contains(alert)
      .click();
  },

  confirmExpireAlert: (yes: boolean) => {
    if (yes) {
      cy.byClass('pf-v6-c-button pf-m-primary pf-m-progress').should('be.visible').click();
    } else {
      cy.byClass('pf-v6-c-button pf-m-secondary').should('be.visible').click();
    };
    cy.byClass('pf-v6-c-button pf-m-primary pf-m-progress').should('not.exist');
  },

  detailsPage: {
    alert: (alert: string) => {
      cy.log('commonPages.detailsPage.alert');
      cy.byClass('co-m-resource-icon co-m-resource-alert').contains('A').should('be.visible');
      cy.byOUIAID('OUIA-Generated-Button-primary').contains('Silence alert').should('be.visible');
      detailsPage.sectionHeaderShouldExist('Alert details');
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').scrollIntoView();
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR').should('be.visible');
      cy.byTestID('alert-rules-detail-resource-link').contains(alert).should('be.visible');

    },
    alertRule: () => {
      cy.log('commonPages.detailsPage.alertRule');
      cy.byClass('co-m-resource-icon co-m-resource-alertrule').contains('AR').should('be.visible');
      cy.byClass('pf-v6-c-code-block__content').should('be.visible');
      cy.byTestID('active-alerts').scrollIntoView();
      cy.byTestID('active-alerts').should('have.length.at.least', 1);
    },
    common: (alert: string, severity: string) => {
      cy.log('commonPages.detailsPage.common');
      commonPages.titleShouldHaveText(alert);
      //2 badges and 1 label severity=Critical
      // cy.byClass('pf-v6-c-label__text').filter(`:contains("${severity}")`).should('be.greaterThan', 1);
      cy.byOUIAID('OUIA-Generated-Button-link').contains('Hide graph').should('be.visible');
      cy.byOUIAID('OUIA-Generated-Card').should('be.visible');
      // cy.byOUIAID('OUIA-Generated-TextInputBase').should('not.be.empty');
      cy.byOUIAID('OUIA-Generated-Button-tertiary').contains('Reset zoom').should('be.visible');
      cy.get(`[aria-label="Inspect"]`).should('be.visible');
      cy.byClass('pf-v6-c-chart').should('be.visible');
    },
    administration_clusterSettings: () => {
      cy.log('commonPages.detailsPage.administration_clusterSettings');
      cy.byLegacyTestID('horizontal-link-Configuration').should('be.visible').click();
      cy.byLegacyTestID('item-filter', { timeout: 250000 }).should('be.visible').type('Alertmanager')
      cy.byLegacyTestID('Alertmanager').should('be.visible').click();
      cy.byLegacyTestID('create-receiver').should('be.visible');
    },
  }

}