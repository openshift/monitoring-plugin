export function clickIfExist(element) {
  cy.get('body').then((body) => {
    if (body.find(element).length > 0) {
      cy.get(element).click();
    }
  });
}

export function getValFromElement(selector: string) {
  cy.log('Get Val from Element');
  cy.get(selector).should('be.visible');
  const elementText = cy.get(selector).invoke('val');
  return elementText;
};

export function getTextFromElement(selector: string) {
  cy.log('Get Text from Element');
  cy.get(selector).should('be.visible');
  const elementText = cy.get(selector).invoke('text');
  return elementText;
};

// PatternFly version detection and abstraction
export function getPFVersion() {
  // Detect PatternFly version from document classes or CSS variables
  const htmlElement = Cypress.$('html')[0];
  if (htmlElement) {
    const classes = htmlElement.className;
    const versionMatch = classes.match(/pf-(v\d+)/);
    if (versionMatch) {
      return versionMatch[1];
    }
  }
  // Fallback to checking for CSS variables
  const style = getComputedStyle(document.documentElement);
  if (style.getPropertyValue('--pf-v6-global--FontSize--md')) {
    return 'v6';
  } else if (style.getPropertyValue('--pf-v5-global--FontSize--md')) {
    return 'v5';
  }
  // Default to current version
  return 'v6';
};