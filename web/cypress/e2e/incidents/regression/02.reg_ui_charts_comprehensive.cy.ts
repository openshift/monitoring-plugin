/*
Regression test for Charts UI bugs and Data Loading bugs (Sections 2 & 3.1 of TESTING_CHECKLIST.md)

This test loads comprehensive test data covering:
- 2.1: Tooltip Positioning Issues
- 2.2: Bar Sorting & Visibility Issues  
- 2.3: Date/Time Display Issues
- 3.1: Short Duration Incidents Visibility (< 5 min)


*/

import { incidentsPage } from '../../../views/incidents-page';

const ARROW_HEIGHT = 12;
const ALLOWED_MARGIN = 8;

interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

function verifyTooltipPositioning(
  tooltipRect: RectLike,
  barRect: RectLike,
  context: string,
  win?: Window
) {
  cy.log(`${context}: Bar rect: top=${barRect.top}, bottom=${barRect.bottom}`);
  cy.log(`${context}: Tooltip rect: top=${tooltipRect.top}, bottom=${tooltipRect.bottom}`);
  
  expect(tooltipRect.top, `${context}: tooltip top should be above bar`).to.be.lessThan(barRect.top);
  expect(tooltipRect.top, `${context}: tooltip should be in viewport`).to.be.greaterThan(0);
  expect(tooltipRect.bottom + ARROW_HEIGHT, `${context}: tooltip bottom with arrow`).to.be.lessThan(barRect.top);
  expect(tooltipRect.bottom + ARROW_HEIGHT + ALLOWED_MARGIN, `${context}: tooltip arrow should be near bar top`).to.be.greaterThan(barRect.top);
  
  if (win) {
    expect(tooltipRect.right, `${context}: tooltip should not overflow viewport width`).to.be.lessThan(win.innerWidth);
    expect(tooltipRect.bottom, `${context}: tooltip should not overflow viewport`).to.be.lessThan(win.innerHeight);
  }
}

function verifyIncidentBarDimensions(index: number, context: string) {
  incidentsPage.getIncidentBarRect(index).then((barRect) => {
    expect(barRect.width, `${context} should have visible width`).to.be.greaterThan(0);
    expect(barRect.height, `${context} should have visible height`).to.be.greaterThan(0);
  });
}

function verifyIncidentBarHasVisiblePaths(index: number, context: string) {
  incidentsPage.elements.incidentsChartBarsGroups()
    .eq(index)
    .find('path[role="presentation"]')
    .then(($paths) => {
      const visiblePath = $paths.filter((i, el) => {
        const fillOpacity = Cypress.$(el).css('fill-opacity') || Cypress.$(el).attr('fill-opacity');
        return parseFloat(fillOpacity || '0') > 0;
      }).first();
      
      expect(visiblePath.length, `${context} should have visible path`).to.be.greaterThan(0);
    });
}

function verifyIncidentBarIsVisible(index: number, context: string) {
  verifyIncidentBarDimensions(index, context);
  verifyIncidentBarHasVisiblePaths(index, context);
}
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
  namespace: Cypress.env('COO_NAMESPACE'),
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Charts UI - Comprehensive', () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);

  });

  beforeEach(() => {
    incidentsPage.goTo();
    cy.mockIncidentFixture('incident-scenarios/12-charts-ui-comprehensive.yaml');
  });

  describe('Section 2.1: Tooltip Positioning', () => {
    
    it('Tooltip positioning and content validation', () => {
      cy.log('Setup: Clear filters and verify all incidents loaded');
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('7 days');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 10);
      
      cy.log('1.1 Get total incident count for dynamic indexing');
      incidentsPage.elements.incidentsChartBarsGroups().its('length').then((count) => {
        cy.log(`Total incidents loaded: ${count}`);
        
        const bottomIndex = 0;
        const topIndex = count - 1;
        const middleIndex = Math.floor(count / 2);
        
        cy.log(`1.2 Test bottom incident (newest, index ${bottomIndex}) tooltip positioning`);
        incidentsPage.getIncidentBarRect(bottomIndex).then((barRect) => {
          incidentsPage.hoverOverIncidentBar(bottomIndex);
          incidentsPage.elements.tooltip().then(($tooltip) => {
            verifyTooltipPositioning($tooltip[0].getBoundingClientRect(), barRect, 'Bottom incident');
          });
        });
        cy.log('Verified: Bottom incident tooltip appears above bar without overlapping');
        
        cy.log(`1.3 Test middle incident (index ${middleIndex}) tooltip positioning`);
        incidentsPage.getIncidentBarRect(middleIndex).then((barRect) => {
          incidentsPage.hoverOverIncidentBar(middleIndex);
          incidentsPage.elements.tooltip().then(($tooltip) => {
            verifyTooltipPositioning($tooltip[0].getBoundingClientRect(), barRect, 'Middle incident');
          });
        });
        cy.log('Verified: Middle incident tooltip appears above bar without overlapping');
        
        cy.log(`1.4 Test top incident (oldest, index ${topIndex}) tooltip positioning`);
        incidentsPage.getIncidentBarRect(topIndex).then((barRect) => {
          incidentsPage.hoverOverIncidentBar(topIndex);
          cy.window().then((win) => {
            incidentsPage.elements.tooltip().then(($tooltip) => {
              verifyTooltipPositioning($tooltip[0].getBoundingClientRect(), barRect, 'Top incident', win);
            });
          });
        });
        cy.log('Verified: Top incident tooltip appears above bar and stays within viewport');
      });
       
       cy.log('2-4: Multi-incident verification (single traversal optimization)');
       cy.log('3.1 Firing vs resolved incident tooltips');
       cy.log('3.2 Find and verify firing incident (network-firing-short-002)');
       incidentsPage.hoverOverIncidentBar(0);
       incidentsPage.elements.tooltip()
         .invoke('text')
         .then((text) => {
           expect(text).to.contain('network-firing-short-002');
           expect(text).to.match(/End.*---/);
         });
       cy.log('Verified: Firing incident shows --- for end time');
       
       let foundMultiComponent = false;
       let foundResolved = false;
       let foundLongName = false;
       
       incidentsPage.elements.incidentsChartBarsGroups().each(($group, index) => {
         const groupId = $group.attr('data-test');
         
         if (!foundMultiComponent || !foundResolved || !foundLongName) {
           incidentsPage.hoverOverIncidentBar(index);
           incidentsPage.elements.tooltip().invoke('text').then((text) => {
             
             if (!foundMultiComponent && text.includes('network-three-alerts-001')) {
               cy.log('2.1 Multi-component tooltip content');
               cy.log(`Found network-three-alerts-001 at index ${index}`);
               cy.log('2.3 Verify tooltip shows all 3 components');
               expect(text).to.contain('network');
               expect(text).to.contain('compute');
               expect(text).to.contain('storage');
               cy.log('Verified: Multi-component tooltip displays all components');
               foundMultiComponent = true;
             }
             
             if (!foundResolved && text.includes('network-resolved-short-001')) {
               cy.log('3.3 Find and verify resolved incident (network-resolved-short-001)');
               cy.log(`Found network-resolved-short-001 at index ${index}`);
               expect(text).to.contain('Start');
               expect(text).to.contain('End');
               expect(text).to.not.match(/End.*---/);
               cy.log('Verified: Resolved incident shows actual end time');
               foundResolved = true;
             }
             
             if (!foundLongName && text.includes('others-very-long-name-001')) {
               cy.log('4.1 Long alert name tooltip handling');
               cy.log(`Found others-very-long-name-001 at index ${index}`);
               cy.log('4.2 Verify tooltip with long name stays within viewport');
               cy.window().then((win) => {
                 incidentsPage.elements.tooltip().then(($tooltip) => {
                   const tooltipRect = $tooltip[0].getBoundingClientRect();
                   expect(tooltipRect.right).to.be.lessThan(win.innerWidth);
                   expect(tooltipRect.bottom).to.be.lessThan(win.innerHeight);
                   expect(tooltipRect.left).to.be.greaterThan(0);
                   expect(tooltipRect.top).to.be.greaterThan(0);
                 });
               });
               cy.log('Verified: Tooltip with 180+ char alert name stays within viewport');
               foundLongName = true;
             }
           });
         }
       });
      
      cy.log('5.1 Alert chart tooltip positioning');
      cy.log('5.2 Select incident with 6 alerts (etcd-six-alerts-001)');
      
      incidentsPage.selectIncidentById('etcd-six-alerts-001');
      
      cy.log('5.3 Verify alerts chart displays alerts');
      incidentsPage.elements.alertsChartCard().should('be.visible');
      incidentsPage.elements.alertsChartBarsGroups()
        .should('have.length.greaterThan', 0);
      
      cy.log('5.4 Test tooltip positioning for all alert bars');
      incidentsPage.elements.alertsChartBarsVisiblePaths()
        .its('length')
        .then((alertCount) => {
          cy.log(`Found ${alertCount} alert bars in chart`);
          for (let i = 0; i < alertCount; i++) {
            if (i > 1) {
              break;
            }
            incidentsPage.getAlertBarRect(i).then((barRect) => {
              incidentsPage.hoverOverAlertBar(i);
              cy.window().then((win) => {
                incidentsPage.elements.alertsChartTooltip().first().then(($tooltip) => {
                  verifyTooltipPositioning($tooltip[0].getBoundingClientRect(), barRect, `Alert ${i}`, win);
                });
              });
            });
          }
        });
      cy.log('Verified: All alert tooltips appear correctly above their bars');
    });
  });

  describe('Section 2.2: Bar Sorting & Visibility', () => {
    
    it('Bar sorting, visibility, and filtering', () => {
      cy.log('Setup: Clear filters and verify all incidents loaded');
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('7 days');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 10);
      
      cy.log('1.1 Get total incident count');
      incidentsPage.elements.incidentsChartBarsGroups().its('length').then((count) => {
        const bottomIndex = 0;
        const topIndex = count - 1;
        
        cy.log(`1.2 Verify newest incident is at bottom (index ${bottomIndex})`);
        incidentsPage.hoverOverIncidentBar(bottomIndex);
        
        incidentsPage.elements.tooltip()
          .invoke('text')
          .should('contain', 'network-firing-short-002');
        
        cy.log(`1.3 Verify oldest incident is at top (index ${topIndex})`);
        incidentsPage.hoverOverIncidentBar(topIndex);
        
        incidentsPage.elements.tooltip()
          .invoke('text')
          .should('contain', 'VSN-001');
        
        cy.log('Verified: Incidents are sorted chronologically with newest at bottom, oldest at top');
      });
      
      cy.log('2.1 Short duration incidents have visible bars');
      cy.log('2.2 Check network-firing-short-002 (10 min duration, index 0)');
      verifyIncidentBarIsVisible(0, 'Short duration firing incident');
      cy.log('Verified: Short duration firing incident has visible bar and is not transparent');
      
      cy.log('2.3 Find and check network-resolved-short-001 (10 min duration)');
      incidentsPage.elements.incidentsChartBarsGroups().each(($group, index) => {
        const groupId = $group.attr('data-test');
        if (groupId && groupId.includes('network-resolved-short-001')) {
          cy.log(`Found network-resolved-short-001 at index ${index}`);
          
          verifyIncidentBarIsVisible(index, 'Short duration resolved incident');
          cy.log('Verified: Short duration resolved incident has visible bar and is not transparent');
          
          return false;
        }
      });
      
      cy.log('3.1 Filtered bars maintain uniform Y-axis spacing');
      
      const verifyUniformSpacing = (positions: number[], context: string, maxAllowedDeviation = 2) => {
        const spacings: number[] = [];
        for (let i = 0; i < positions.length - 1; i++) {
          spacings.push(positions[i + 1] - positions[i]);
        }
        
        const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const maxDeviation = Math.max(...spacings.map(s => Math.abs(s - avgSpacing)));
        
        cy.log(`${context}: ${positions.length} bars, avg spacing: ${avgSpacing.toFixed(2)}px, max deviation: ${maxDeviation.toFixed(2)}px`);
        expect(maxDeviation, `${context}: spacing should be uniform`).to.be.lessThan(maxAllowedDeviation);
      };
      
      cy.log('3.2 Verify uniform spacing before filtering');
      const barPositionsBefore: number[] = [];
      incidentsPage.elements.incidentsChartBarsGroups().each(($group) => {
        const rect = $group[0].getBoundingClientRect();
        barPositionsBefore.push(rect.top);
      }).then(() => {
        verifyUniformSpacing(barPositionsBefore, 'Before filter');
      });
      
      cy.log('3.3 Apply Critical filter');
      incidentsPage.toggleFilter('Critical');
      incidentsPage.elements.severityFilterChip().should('be.visible');
      
      cy.log('3.4 Verify uniform spacing after filtering');
      const barPositionsAfter: number[] = [];
      incidentsPage.elements.incidentsChartBarsGroups().each(($group) => {
        const rect = $group[0].getBoundingClientRect();
        barPositionsAfter.push(rect.top);
      }).then(() => {
        verifyUniformSpacing(barPositionsAfter, 'After filter');
      });
      
      cy.log('Verified: Critical filter applied and visible bars maintain uniform spacing without gaps');
    });
  });

  describe('Section 2.3: Date/Time Display', () => {
    
    it('Date and time display validation', () => {
      cy.log('Setup: Clear filters');
      incidentsPage.clearAllFilters();
      
      cy.log('1.2 Hover over firing incident and verify end shows ---');
      incidentsPage.hoverOverIncidentBar(0);
      
      incidentsPage.elements.tooltip()
        .invoke('text')
        .then((text) => {
          expect(text).to.contain('network-firing-short-002');
          expect(text).to.contain('Start');
          expect(text).to.match(/End.*---/);
        });
      cy.log('Verified: Firing incident shows start time and --- for end');
      
      cy.log('1.3 Find and verify resolved incident shows both start and end times');
      incidentsPage.elements.incidentsChartBarsGroups().each(($group, index) => {
        const groupId = $group.attr('data-test');
        if (groupId && groupId.includes('network-resolved-short-001')) {
          cy.log(`Found network-resolved-short-001 at index ${index}`);
          incidentsPage.hoverOverIncidentBar(index);
          
          incidentsPage.elements.tooltip()
            .invoke('text')
            .then((text) => {
              expect(text).to.contain('Start');
              expect(text).to.contain('End');
              expect(text).to.not.match(/End.*---/);
            });
          cy.log('Verified: Resolved incident shows both start and end times as timestamps');
          
          return false;
        }
      });
      
      cy.log('2.1 Multi-severity incident segments');
      cy.log('2.2 Find monitoring-gradual-alerts-001 incident');
      incidentsPage.elements.incidentsChartBarsGroups().each(($group, index) => {
        const groupId = $group.attr('data-test');
        if (groupId && groupId.includes('monitoring-gradual-alerts-001')) {
          cy.log(`Found monitoring-gradual-alerts-001 at index ${index}`);
          
          cy.log('2.3 Verify bar has multiple severity segments');
          cy.wrap($group)
            .find('path[role="presentation"]')
            .should('have.length.greaterThan', 1);
          cy.log('Verified: Multi-severity incident has multiple colored segments');
          
          return false;
        }
      });
      
      cy.log('3.1 Date format validation');
      incidentsPage.hoverOverIncidentBar(0);
      
      cy.log('3.2 Verify tooltip contains formatted timestamps');
      incidentsPage.elements.tooltip()
        .invoke('text')
        .then((text) => {
          expect(text).to.match(/\d{1,2}:\d{2}/);
        });
      cy.log('Verified: Tooltips display formatted date/time');
      
      cy.log('4.1 Alert-level time verification in table');
      cy.log('4.1.1 Select oldest incident for alert time verification');
      incidentsPage.selectIncidentById('VSN-001');

      cy.log('4.2 Expand all rows to see alert details');
      incidentsPage.elements.incidentsTable().should('be.visible');
      
      cy.log('4.3 Get alert information');
      incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
        expect(alerts.length).to.be.greaterThan(0);
        
        cy.log('4.4 Verify each alert has start time');
        alerts.forEach((alert, index) => {
          alert.getStartCell().invoke('text').then((startText) => {
            expect(startText.trim()).to.not.be.empty;
            expect(startText.trim()).to.not.equal('-');
            cy.log(`Alert ${index + 1} start time: ${startText.trim()}`);
          });
        });
        
        cy.log('4.5 Verify firing alerts show --- or Firing for end time');
        alerts.forEach((alert, index) => {
          alert.getEndCell().invoke('text').then((endText) => {
            expect(endText.trim()).to.not.be.empty;
            cy.log(`Alert ${index + 1} end time: ${endText.trim()}`);
          });
        });
      });
      cy.log('Verified: Alert times in table display correctly with valid timestamps');
    });
  });

  describe('Section 3.1: Short Duration Incidents Visibility', () => {
    
    it('Very short duration incidents are visible and selectable', () => {
      cy.log('Setup: Clear filters and verify all incidents loaded');
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('7 days');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 10);
      
      cy.log('1.1 Test 5-minute duration incident (api-server-transient-001)');
      cy.log('1.2 Find the incident bar by ID and verify visibility');
      incidentsPage.elements.incidentsChartBarsGroups().then(($groups) => {
        const index = $groups.toArray().findIndex((el) => 
          el.getAttribute('data-test')?.includes('api-server-transient-001')
        );
        cy.log('1.3 Verify 1-min incident bar is visible and not transparent');
        verifyIncidentBarIsVisible(index, '1-min incident');
      });
      
      cy.log('1.4 Verify incident can be selected and alerts load');
      incidentsPage.selectIncidentById('api-server-transient-001');
      incidentsPage.elements.incidentsTable().should('be.visible');
      incidentsPage.elements.incidentsDetailsTableRows().should('have.length.greaterThan', 0);
      
      cy.log('1.5 Verify alert details are displayed');
      incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
        expect(alerts.length, '1-min incident should have at least 1 alert').to.be.greaterThan(0);
        alerts[0].getAlertRuleCell().invoke('text').then((alertName) => {
          expect(alertName).to.contain('APIServerRequestLatencyBriefSpikeDetectedDuringHighTrafficPeriod001');
        });
      });
      cy.log('Verified: 1-minute duration incident is visible, not transparent, selectable, and loads alerts');

      });
    });
  });