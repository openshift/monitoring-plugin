import { commonPages } from "./common";
import { detailsPage } from "./details-page";

const silenceText = 'Silences temporarily mute alerts based on a set of label selectors that you define. Notifications will not be sent for alerts that match all the listed values or regular expressions.'
const alertText = 'Alerts with labels that match these selectors will be silenced instead of firing. Label values can be matched exactly or with a regular expression'
const editWarningTitle = 'Overwriting current silence'
const editMessage = 'When changes are saved, the currently existing silence will be expired and a new silence with the new configuration will take its place.'


export const silenceAlertPage = {
  
  silenceAlertSectionDefault: () => {
    cy.log('silenceAlertPage.silenceAlertSectionDefault');
    cy.byClass('pf-v6-c-helper-text__item-text').eq(0).contains(silenceText).should('be.visible');
  },

  editAlertWarning: () => {
    cy.log('silenceAlertPage.editAlertWarning');
    cy.byClass('pf-v6-c-alert__title').contains(editWarningTitle).should('be.visible');
    cy.byClass('pf-v6-c-alert__description').contains(editMessage).should('be.visible');
  },

  durationSectionDefault: () => {
    cy.log('silenceAlertPage.durationSectionDefault');
    cy.get('[id="start-immediately"]').should('be.checked');
    cy.byTestID('silence-from').should('have.value', 'Now');
    cy.byTestID('silence-for-toggle').should('contain', '2h');
    cy.byTestID('silence-until').should('have.value', '2h from now');
  },

  editDurationSectionDefault: () => {
    cy.log('silenceAlertPage.durationSectionDefault');
    cy.get('[id="start-immediately"]').should('be.checked');
    cy.byTestID('silence-from').should('have.value', 'Now');
    cy.byTestID('silence-for-toggle').should('contain', '-');
    cy.byTestID('silence-until').should('not.have.value', '2h from now');
  },

  alertLabelsSectionDefault: () => {
    cy.log('silenceAlertPage.alertLabelsSectionDefault');
    cy.byClass('pf-v6-c-helper-text__item-text').eq(1).contains(alertText).should('be.visible');
  },

  assertLabelNameLabelValueRegExNegMatcher: (labelName: string, labelValue: string, regEx: boolean, negMatcher: boolean) => {
    cy.log('silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher');
    cy.byClass('pf-v6-l-grid pf-m-all-12-col-on-sm pf-m-all-4-col-on-md pf-m-gutter').each(($row, rowIndex) => {
      cy.wrap($row).find('[aria-label="Label name"]').invoke('val').then((cellText) => {
        if (cellText === labelName){
          cy.wrap($row).find('[aria-label="Label name"]').invoke('val').should('equal', labelName);
          cy.wrap($row).find('[aria-label="Label value"]').invoke('val').should('equal', labelValue);
          if (regEx){
            cy.wrap($row).find('.pf-v6-c-check__input').first().should('be.checked');
          } else{
            cy.wrap($row).find('.pf-v6-c-check__input').first().should('not.be.checked');
          }
          if (negMatcher){
            cy.wrap($row).find('.pf-v6-c-check__input').last().should('be.checked');
          } else{
            cy.wrap($row).find('.pf-v6-c-check__input').last().should('not.be.checked');
          }
          cy.wrap($row).find('[aria-label="Remove"]').should('be.visible');
        } else {
          return;
        }
      })
    })
  },

  infoSectionDefault: () => {
    cy.log('silenceAlertPage.infoSectionDefault');
    cy.get('[aria-label="Creator"]').invoke('val')
      .should('not.be.empty')
      .should('have.attr', 'required');
    cy.get('[aria-label="Comment"').invoke('text')
      .should('be.empty')
      .should('have.attr', 'required');
  },

  buttonDefault: () => {
    cy.log('silenceAlertPage.buttonDefault');
    cy.byOUIAID('OUIA-Generated-Button-primary')
      .should('be.visible');
    cy.byOUIAID('OUIA-Generated-Button-secondary')
      .should('be.visible');
  },
  
  clickCancelButton: () => {
    cy.log('silenceAlertPage.clickCancelButton');
    cy.byOUIAID('OUIA-Generated-Button-secondary').scrollIntoView().should('be.visible').click();
  },
  /**
   * changeDuration only changing For (time dropdown) and Start immediately checkbox
   * @param time 
   * @param startImmediately 
   */
  setForAndStartImmediately: (time: string, startImmediately: boolean) => {
    cy.log('silenceAlertPage.setForAndStartImmediately');
    cy.byTestID('silence-for-toggle').click();
    cy.byTestID('silence-for').should('contain', time);  
    cy.byTestID('silence-for').contains(time).click();  

    cy.get('[id="start-immediately"]').then((checkbox) => {
      if (startImmediately){
        if (!checkbox.prop('checked') ){
          cy.get('[id="start-immediately"]').click();
        }
        cy.byTestID('silence-from').should('have.value', 'Now');
        cy.byTestID('silence-until').should('have.value', time +' from now');

      } else {
        if (checkbox.prop('checked')){
          cy.get('[id="start-immediately"]').click();
        }
        cy.byTestID('silence-from').should('have.not.value', 'Now');
        cy.byTestID('silence-from').then(($fromElement) => {
          const fromText = $fromElement[0].getAttribute('value');
          expect(Date.parse(fromText) - Date.now()).to.be.lessThan(10000);
          // eslint-disable-next-line promise/no-nesting
          cy.byTestID('silence-until').then(($untilElement) => {
            const unit = time.slice(-1);
            const value = parseInt(time.slice(0,-1), 10);
            let silenceUntilDate = new Date(fromText);

            switch(unit){
              case 'm':
                silenceUntilDate.setMinutes(silenceUntilDate.getMinutes() + value);
                break;
              case 'h':
                silenceUntilDate.setHours(silenceUntilDate.getHours() + value);
                break;
              case 'd':
                silenceUntilDate.setDate(silenceUntilDate.getDate() + value);
                break;
              case 'w':
                silenceUntilDate.setDate(silenceUntilDate.getDate() + (value * 7));
                break;
            };

            const formatDateTime = (date) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const seconds = String(date.getSeconds()).padStart(2, '0');
              return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
            };
            expect(($untilElement[0].getAttribute('value'))).to.equal(formatDateTime(silenceUntilDate))

          });
        });
      } //else
    })//cy.get
  },//change duration

  setSilenceFrom: (fromTimestamp: string) => {
    cy.log('silenceAlertPage.setSilenceFrom');
    cy.byTestID('silence-from').clear().type(fromTimestamp);
  },

  addCreator: (creator: string) => {
    cy.log('silenceAlertPage.addCreator');
    if (!creator){
      cy.get('[aria-label="Creator"]').clear();
    } else{
      cy.get('[aria-label="Creator"]').clear().type(creator);
    }
    
  },

  addComment: (comment: string) => {
    cy.log('silenceAlertPage.addComment');
    cy.byTestID('silence-comment').type(comment);
    
  },
  clickSubmit: () =>{
    cy.log('silenceAlertPage.clickSubmit');
    cy.get('button[type=submit]').scrollIntoView().should('be.visible').click();
  },

  assertCommentNoError: () => {
    cy.log('silenceAlertPage.assertCommentNoError');
    cy.byClass('pf-v6-c-form-control pf-m-textarea pf-m-resize-both').should('not.have.class', 'pf-m-error');
  },

  assertCommentWithError: () => {
    cy.log('silenceAlertPage.assertCommentWithError');
    cy.byClass('pf-v6-c-form-control pf-m-textarea pf-m-resize-both pf-m-error').should('be.visible');
    cy.byClass('pf-v6-c-alert__title').should('contain.text', 'Comment is required');
  },

  assertCreatorWithError:() => {
    cy.log('silenceAlertPage.assertCreatorWithError');
    cy.byClass('pf-v6-c-form-control pf-m-error').should('be.visible');
  },

  fillLabeNameLabelValue: (labelName: string, labelValue: string) => {
    cy.log('silenceAlertPage.fillLabeNameLabelValue');
    cy.byClass('pf-v6-l-grid pf-m-all-12-col-on-sm pf-m-all-4-col-on-md pf-m-gutter').each(($row, rowIndex) => {
      cy.wrap($row).find('[aria-label="Label name"]').invoke('val').then((cellText) => {
        if (!labelName){
          cy.wrap($row).find('[aria-label="Label name"]').clear();
        } else {
          cy.wrap($row).find('[aria-label="Label name"]').clear().type(labelName);
        }
         if (!labelValue){
          cy.wrap($row).find('[aria-label="Label value"]').clear();
        } else {
          cy.wrap($row).find('[aria-label="Label value"]').clear().type(labelValue);
        }
      })
    });     
  },

  assertLabelNameError: () => {
    cy.log('silenceAlertPage.assertLabelNameError');
    cy.byClass('pf-v6-c-alert__title').should('contain.text', 'invalid label name ""');
  },

  assertLabelValueError: () => {
    cy.log('silenceAlertPage.assertLabelValueError');
    cy.byClass('pf-v6-c-alert__title').should('contain.text', 'invalid silence: at least one matcher must not match the empty string');
  },


};
