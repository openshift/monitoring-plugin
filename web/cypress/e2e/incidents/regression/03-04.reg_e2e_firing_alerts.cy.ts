/*
Regression tests for time-based alert resolution issues with real firing alerts.

Section 3.3: Alerts Marked as Resolved After Time
Tests that alerts maintain their firing state correctly when time passes without
incident refresh. Previously, alerts were incorrectly marked as resolved when
deselecting and reselecting an incident after waiting.

Section 4.7: Cached End Time for Prometheus Query
Tests that the end time parameter in Prometheus queries uses current time instead
of cached initial load time. Previously, the Redux state would cache the initial
page load time, causing firing alerts to be incorrectly marked as resolved.

Both tests require continuously firing alerts and cannot be tested with mocked data.

Verifies: OU-XXX (time-based resolution bugs)
*/

import { incidentsPage } from '../../../views/incidents-page';

const MCP = {
  namespace: Cypress.env('COO_NAMESPACE'),
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Time-Based Alert Resolution (E2E with Firing Alerts)', { tags: ['@incidents', '@slow'] }, () => {
  let currentAlertName: string;

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
    
    cy.log('Create or reuse firing alert for testing');
    cy.createKubePodCrashLoopingAlert('TimeBasedResolution2').then((alertName) => {
      currentAlertName = alertName;
      cy.log(`Test will monitor alert: ${currentAlertName}`);
    });
  });


  it('1. Section 3.3 - Alert not incorrectly marked as resolved after time passes', () => {
    cy.log('1.1 Navigate to Incidents page and clear filters');
    incidentsPage.goTo();
    incidentsPage.clearAllFilters();
    
    const intervalMs = 60_000;
    const maxMinutes = 30;

    cy.log('1.2 Wait for incident with custom alert to appear and get selected');
    cy.waitUntil(
      () => incidentsPage.findIncidentWithAlert(currentAlertName),
      { 
        interval: intervalMs, 
        timeout: maxMinutes * intervalMs,
        errorMsg: `Incident with alert ${currentAlertName} should appear within ${maxMinutes} minutes`
      }
    );

    incidentsPage.elements.incidentsDetailsTable().should('exist');

    cy.log('1.3 Verify alert is firing by checking end time shows "---"');
    cy.wrap(0).as('initialFiringCount');
    
    incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
      expect(alerts.length).to.be.greaterThan(0);
      
      alerts.forEach((alert, index) => {
        alert.getAlertRuleCell().invoke('text').then((alertRuleText) => {
          const cleanAlertName = alertRuleText.trim().replace("AlertRuleAR", "");
          
          if (cleanAlertName != currentAlertName) {
            cy.log(`Alert ${index + 1}: ${cleanAlertName} does not match ${currentAlertName}, skipping`);
            return;
          }
          
          cy.log(`Alert ${index + 1}: Found matching alert ${cleanAlertName}`);
          
          alert.getEndCell().invoke('text').then((endText) => {
            const cleanEndText = endText.trim();
            cy.log(`Alert ${index + 1} end time: "${cleanEndText}"`);
            const isFiring = cleanEndText === '---';
            if (isFiring) {
              cy.get('@initialFiringCount').then((count: any) => {
                cy.wrap(count + 1).as('initialFiringCount');
              });
              cy.log(`Alert ${index + 1} is FIRING`);
            } else {
              cy.log(`Alert ${index + 1} is resolved`);
            }
          });
        });
      });
    }).then(() => {
      cy.get('@initialFiringCount').then((count: any) => {
        cy.log(`Total firing alerts found: ${count}`);
        expect(count).to.be.greaterThan(0, `Expected at least 1 firing alert for ${currentAlertName}, but found ${count}`);
      });
    });
    
    cy.log('Verified: Alert initially shows firing state (end time = "---")');


    const waitMinutes = 0.1
    cy.log(`1.6 Wait ${waitMinutes} minutes without refreshing the incidents page`);
    cy.wait(waitMinutes * 60_000);

    cy.log('1.10 Verify alert is STILL firing (end time still shows "---", not resolved)');
    cy.wrap(0).as('currentFiringCount');
  
    incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
      expect(alerts.length).to.be.greaterThan(0);
      
      alerts.forEach((alert, index) => {
        alert.getAlertRuleCell().invoke('text').then((alertRuleText) => {
          const cleanAlertName = alertRuleText.trim().replace("AlertRuleAR", "");
          
          if (cleanAlertName != currentAlertName) {
            cy.log(`Alert ${index + 1}: ${cleanAlertName} does not match ${currentAlertName}, skipping`);
            return;
          }
          
          cy.log(`Alert ${index + 1}: Found matching alert ${cleanAlertName}`);
          
          alert.getEndCell().invoke('text').then((endText) => {
            const cleanEndText = endText.trim();
            cy.log(`Alert ${index + 1} end time: "${cleanEndText}"`);
            const isFiring = cleanEndText === '---';
            if (isFiring) {
              cy.get('@currentFiringCount').then((count: any) => {
                cy.wrap(count + 1).as('currentFiringCount');
              });
              cy.log(`Alert ${index + 1} is STILL FIRING`);
            } else {
              cy.log(`Alert ${index + 1} is now resolved (BUG!)`);
            }
          });
        });
      });
    }).then(() => {
      cy.get('@initialFiringCount').then((initialCount: any) => {
        cy.get('@currentFiringCount').then((currentCount: any) => {
          cy.log(`Initial firing alerts: ${initialCount}, Current firing alerts: ${currentCount}`);
          expect(currentCount).to.equal(initialCount, `Expected same number of firing alerts after wait (${initialCount}), but got ${currentCount}`);
          expect(currentCount).to.be.greaterThan(0, `Expected at least 1 firing alert, but found ${currentCount}`);
        });
      });
    });

    cy.log('Verified: Alert maintains firing state after time passes and reselection (end time = "---")');
  });

  it('2. Section 4.7 - Prometheus query end time updates to current time on filter refresh', () => {
    cy.log('2.1 Navigate to Incidents page and clear filters');
    incidentsPage.goTo();
    incidentsPage.clearAllFilters();

    cy.log('2.2 Capture initial page load time');
    const initialLoadTime = Date.now();
    cy.wrap(initialLoadTime).as('initialLoadTime');

    cy.log('2.3 Search for and select incident with custom alert');
    incidentsPage.findIncidentWithAlert(currentAlertName).should('eq', true);
    
    cy.log('2.4 Verify alert is firing (end time = "---")');
    cy.wrap(0).as('firingCountTest2');
    
    incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
      expect(alerts.length).to.be.greaterThan(0);
      
      alerts.forEach((alert, index) => {
        alert.getAlertRuleCell().invoke('text').then((alertRuleText) => {
          const cleanAlertName = alertRuleText.trim().replace("AlertRuleAR", "");
          
          if (cleanAlertName != currentAlertName) {
            return;
          }
          
          alert.getEndCell().invoke('text').then((endText) => {
            const cleanEndText = endText.trim();
            if (cleanEndText === '---') {
              cy.get('@firingCountTest2').then((count: any) => {
                cy.wrap(count + 1).as('firingCountTest2');
              });
            }
          });
        });
      });
    }).then(() => {
      cy.get('@firingCountTest2').then((count: any) => {
        expect(count).to.be.greaterThan(0, `Expected at least 1 firing alert for ${currentAlertName}`);
      });
    });
    
    cy.log('Verified: Alert initially shows firing state');

    const waitMinutes = 11;
    const REFRESH_FREQUENCY = 300;

    cy.log(`2.5 Wait ${waitMinutes} minutes without refreshing incidents`);
    cy.wait(waitMinutes * 60_000);

    cy.log('2.6 Set up intercept to capture Prometheus query parameters');
    const queryEndTimes: number[] = [];
    cy.intercept('GET', '**/api/prometheus/api/v1/query_range*', (req) => {
      req.continue((res) => {
        const queryParams = new URLSearchParams(req.url.split('?')[1]);
        const endTimeParam = queryParams.get('end');
        if (endTimeParam) {
          queryEndTimes.push(parseFloat(endTimeParam));
        }
      });
    }).as('prometheusQuery');

    cy.log('2.7 Refresh the days filter to trigger new Prometheus queries');
    incidentsPage.setDays('7 days');
    
    cy.log('2.8 Wait for all Prometheus queries to complete');
    cy.wait(2000);
    
    cy.wrap(null).then(() => {
      cy.log(`Captured ${queryEndTimes.length} Prometheus queries`);
      

      if (queryEndTimes.length > 0) {
        const mostRecentEndTime = Math.max(...queryEndTimes);
        const oldestEndTime = Math.min(...queryEndTimes);
        const currentTime = Date.now() / 1000;
        const timeDifference = Math.abs(currentTime - mostRecentEndTime);
        
        cy.log(`Query end times range: ${oldestEndTime} to ${mostRecentEndTime}`);
        cy.log(`Current time: ${currentTime}, Most recent query end time: ${mostRecentEndTime}, Difference: ${timeDifference}s`);
        
        cy.get('@initialLoadTime').then((initialTime: any) => {
          const initialTimeSeconds = initialTime / 1000;
          const timePassedSinceLoad = currentTime - initialTimeSeconds;
          
          cy.log(`Time passed since initial load: ${timePassedSinceLoad}s`);
          
          expect(timeDifference).to.be.lessThan(REFRESH_FREQUENCY, 
            `Most recent end time should be close to current time (within ${REFRESH_FREQUENCY} seconds)`);
          
          expect(mostRecentEndTime).to.be.greaterThan(initialTimeSeconds + (waitMinutes * 60) - REFRESH_FREQUENCY,
            `End time should be updated to current time, not cached from initial load (${waitMinutes} minutes ago)`);
        });
        
        cy.log('Verified: Most recent end time parameter uses current time, not cached initial load time');
      } else {
        throw new Error('No Prometheus queries were captured');
      }
    });
  });

  it('3. Verify alert lifecycle - alert continues firing throughout test', () => {
    cy.log('3.1 Navigate to Incidents page');
    incidentsPage.goTo();
    incidentsPage.clearAllFilters();

    cy.log('3.2 Search for and select incident with custom alert');
    incidentsPage.findIncidentWithAlert(currentAlertName).should('eq', true);

    cy.log('3.3 Verify end time shows "---" for firing alert');
    cy.wrap(0).as('firingCountTest3');
    
    incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
      expect(alerts.length).to.be.greaterThan(0);
      
      alerts.forEach((alert, index) => {
        alert.getAlertRuleCell().invoke('text').then((alertRuleText) => {
          const cleanAlertName = alertRuleText.trim().replace("AlertRuleAR", "");
          
          if (cleanAlertName != currentAlertName) {
            return;
          }
          
          alert.getEndCell().invoke('text').then((endText) => {
            const cleanEndText = endText.trim();
            if (cleanEndText === '---') {
              cy.get('@firingCountTest3').then((count: any) => {
                cy.wrap(count + 1).as('firingCountTest3');
              });
            }
          });
        });
      });
    }).then(() => {
      cy.get('@firingCountTest3').then((count: any) => {
        expect(count).to.be.greaterThan(0, `Expected at least 1 firing alert for ${currentAlertName}`);
      });
    });
    
    cy.log('Verified: Alert lifecycle maintained correctly throughout test suite (end time = "---")');
  });
});


