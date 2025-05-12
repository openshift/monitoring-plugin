export function clickIfExist(element) {
    cy.get('body').then((body) => {
      if (body.find(element).length > 0) {
        cy.get(element).click();
      }
    });
  }