import { DataTestIDs, Classes } from '../../src/components/data-test';
const silenceText = 'Silences temporarily mute alerts based on a set of label selectors that you define. Notifications will not be sent for alerts that match all the listed values or regular expressions.'
const alertText = 'Alerts with labels that match these selectors will be silenced instead of firing. Label values can be matched exactly or with a regular expression'
const editWarningTitle = 'Overwriting current silence'
const editMessage = 'When changes are saved, the currently existing silence will be expired and a new silence with the new configuration will take its place.'


export const silenceAlertPage = {
  
  silenceAlertSectionDefault: () => {
    cy.log('silenceAlertPage.silenceAlertSectionDefault');
    cy.get(Classes.SilenceHelpText).eq(0).contains(silenceText).should('be.visible');
  },

  editAlertWarning: () => {
    cy.log('silenceAlertPage.editAlertWarning');
    cy.get(Classes.SilenceAlertTitle).contains(editWarningTitle).should('be.visible');
    cy.get(Classes.SilenceAlertDescription).contains(editMessage).should('be.visible');
  },

  durationSectionDefault: () => {
    cy.log('silenceAlertPage.durationSectionDefault');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.StartImmediately).should('be.checked');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFrom).should('have.value', 'Now');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceForToggle).should('contain', '2h');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceUntil).should('have.value', '2h from now');
  },

  editDurationSectionDefault: () => {
    cy.log('silenceAlertPage.durationSectionDefault');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.StartImmediately).should('be.checked'); //pf-5 cy.byTestID('[id="silence-start-immediately"]').should('be.checked'); 
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFrom).should('have.value', 'Now');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceForToggle).should('contain', '-');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceUntil).should('not.have.value', '2h from now');
  },

  alertLabelsSectionDefault: () => {
    cy.log('silenceAlertPage.alertLabelsSectionDefault');
    cy.get(Classes.SilenceHelpText).eq(1).contains(alertText).should('be.visible'); //pf-5 cy.byClass('.co-help-text.monitoring-silence-alert__paragraph').contains(alertText).should('be.visible');
  },

  assertLabelNameLabelValueRegExNegMatcher: (labelName: string, labelValue: string, regEx: boolean, negMatcher: boolean) => {
    cy.log('silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher');
    cy.byClass('pf-v6-l-grid pf-m-all-12-col-on-sm pf-m-all-4-col-on-md pf-m-gutter').each(($row, rowIndex) => { //pf-5 cy.get('.row').each(($row, rowIndex) => {
      cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').invoke('val').then((cellText) => {
        if (cellText === labelName){
          cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').invoke('val').should('equal', labelName);
          cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').invoke('val').should('equal', labelValue);
          if (regEx){
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.Regex+'"]').should('be.checked'); 
          } else{
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.Regex+'"]').should('not.be.checked');
          }
          if (negMatcher){
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.NegativeMatcherCheckbox+'"]').should('be.checked');
          } else{
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.NegativeMatcherCheckbox+'"]').should('not.be.checked');
          }
          cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.RemoveLabel+'"]').should('be.visible');
        } else {
          return;
        }
      })
    })
  },

  assertNamespaceLabelNamespaceValueDisabled: (labelName: string, labelValue: string, disabled: boolean) => {
    cy.log('silenceAlertPage.assertNamespaceLabelNamespaceValueDisabled');
    cy.byClass('pf-v6-l-grid pf-m-all-12-col-on-sm pf-m-all-4-col-on-md pf-m-gutter').each(($row, rowIndex) => { //pf-5 cy.get('.row').each(($row, rowIndex) => {
      cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').invoke('val').then((cellText) => {
        if (cellText === labelName){
          cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').invoke('val').should('equal', labelName);
          cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').invoke('val').should('equal', labelValue);
          if (disabled){
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').should('have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').should('have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.Regex+'"]').should('have.attr', 'disabled'); 
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.NegativeMatcherCheckbox+'"]').should('have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.RemoveLabel+'"]').should('have.attr', 'disabled');
          } else{
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').should('not.have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').should('not.have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.Regex+'"]').should('not.have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.NegativeMatcherCheckbox+'"]').should('not.have.attr', 'disabled');
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.RemoveLabel+'"]').should('not.have.attr', 'disabled');
          }
        } else {
          return;
        }
      })
    })
  },

  infoSectionDefault: () => {
    cy.log('silenceAlertPage.infoSectionDefault');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.Creator).invoke('val')
      .should('not.be.empty')
      .should('have.attr', 'required');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.Comment).invoke('text')
      .should('be.empty')
      .should('have.attr', 'required');
  },

  buttonDefault: () => {
    cy.log('silenceAlertPage.buttonDefault');
    cy.byTestID(DataTestIDs.SilenceButton).should('be.visible');
    cy.byTestID(DataTestIDs.CancelButton).should('be.visible');
  },
  
  clickCancelButton: () => {
    cy.log('silenceAlertPage.clickCancelButton');
    cy.byTestID(DataTestIDs.CancelButton).scrollIntoView().should('be.visible').click();
  },
  /**
   * changeDuration only changing For (time dropdown) and Start immediately checkbox
   * @param time 
   * @param startImmediately 
   */
  setForAndStartImmediately: (time: string, startImmediately: boolean) => {
    cy.log('silenceAlertPage.setForAndStartImmediately');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceForToggle).click();
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFor).should('contain', time);  
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFor).contains(time).click();  

    cy.get('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.StartImmediately+'"]').then((checkbox) => { //pf-5 cy.byTestID('[id="silence-start-immediately"]')
      if (startImmediately){
        if (!checkbox.prop('checked') ){
          cy.get('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.StartImmediately+'"]').click(); //pf-5 cy.byTestID('[id="silence-start-immediately"]').click(); 
        }
        cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFrom).should('have.value', 'Now');
        cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceUntil).should('have.value', time +' from now');

      } else {
        if (checkbox.prop('checked')){
          cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.StartImmediately).click(); //pf-5 cy.byTestID('[id="silence-start-immediately"]').click(); 
        }
        cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFrom).should('have.not.value', 'Now');
        cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFrom).then(($fromElement) => {
          const fromText = $fromElement[0].getAttribute('value');
          expect(Date.parse(fromText) - Date.now()).to.be.lessThan(10000);
          // eslint-disable-next-line promise/no-nesting
          cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceUntil).then(($untilElement) => {
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
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.SilenceFrom).clear().type(fromTimestamp);
  },

  addCreator: (creator: string) => {
    cy.log('silenceAlertPage.addCreator');
    if (!creator){
      cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.Creator).clear();
    } else{
      cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.Creator).clear().type(creator);
    }
    
  },

  addComment: (comment: string) => {
    cy.log('silenceAlertPage.addComment');
    cy.byTestID(DataTestIDs.SilencesPageFormTestIDs.Comment).type(comment);
    
  },
  clickSubmit: () =>{
    cy.log('silenceAlertPage.clickSubmit');
    cy.byTestID(DataTestIDs.SilenceButton).scrollIntoView().should('be.visible').click();
  },
  /**
   * pf-6 only
   */
  assertCommentNoError: () => {
    cy.log('silenceAlertPage.assertCommentNoError');
    cy.get(Classes.SilenceCommentWithoutError).should('not.have.class', 'pf-m-error');
  },

  /**
   * pf-6 only
   */
  assertCommentWithError: () => {
    cy.log('silenceAlertPage.assertCommentWithError');
    cy.get(Classes.SilenceCommentWithError).should('be.visible');
    cy.get(Classes.SilenceAlertTitle).should('contain.text', 'Comment is required');
  },

  /**
   * pf-6 only
   */
  assertCreatorWithError:() => {
    cy.log('silenceAlertPage.assertCreatorWithError');
    cy.get(Classes.SilenceCreatorWithError).should('be.visible');
  },

  fillLabeNameLabelValue: (labelName: string, labelValue: string, index?: number) => {
    cy.log('silenceAlertPage.fillLabeNameLabelValue');
    cy.get(Classes.SilenceLabelRow).each(($row, rowIndex) => {
      cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').invoke('val').then((cellText) => {
        if (index){
          if (rowIndex === index){
            if (!labelName){
              cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').clear();
            } else {
              cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').clear().type(labelName);
            }
            if (!labelValue){
              cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').clear();
            } else {
              cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').clear().type(labelValue);
            }
          }
        }
        else{
          if (!labelName){
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').clear();
          } else {
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelName+'"]').clear().type(labelName);
          }
          if (!labelValue){
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').clear();
          } else {
            cy.wrap($row).find('[data-test="'+DataTestIDs.SilencesPageFormTestIDs.LabelValue+'"]').clear().type(labelValue);
          }
        }
      })
    });     
  },

  assertLabelNameError: () => {
    cy.log('silenceAlertPage.assertLabelNameError');
    cy.get(Classes.SilenceAlertTitle).should('contain.text', 'invalid label name ""');
  },

  assertLabelValueError: () => {
    cy.log('silenceAlertPage.assertLabelValueError');
    cy.get(Classes.SilenceAlertTitle).should('contain.text', 'invalid silence: at least one matcher must not match the empty string');
  },

};
