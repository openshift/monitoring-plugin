# PatternFly Cypress Commands - Usage Examples

This file provides comprehensive examples of PatternFly-aware Cypress commands for distributed tracing UI testing, focusing on semantic selectors and efficient testing patterns.

## ✅ Recommended Usage Patterns

### 1. Simple Component Interactions

```typescript
// Empty State - Clean and reliable
cy.pfEmptyState().within(() => {
  cy.byRole('heading').should('contain', 'No items found');
});

// Buttons - Direct and stable
cy.pfButton('Create Instance').click();
cy.pfButton('Save Changes').should('be.disabled');
cy.pfButton('Cancel').should('be.visible');
```

### 2. Menu Navigation

```typescript
// Basic menu toggle
cy.pfMenuToggle('Select Instance').click();
cy.pfMenuItem('TempoStack').click();

// Or with error handling for dynamic content
cy.get('body').then(($body) => {
  if ($body.find('.pf-v6-c-menu-toggle:contains("Create Instance")').length > 0) {
    cy.pfMenuToggle('Create Instance').click();
    cy.pfMenuItem('TempoStack Instance').click();
  }
});
```

### 3. Toolbar Interactions (Recommended Approach)

```typescript
// Simple toolbar item selection
cy.pfToolbarItem(0).within(() => {
  cy.get('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle').first().click();
});
cy.get('.pf-v6-c-menu__item, .pf-v5-c-menu__item').contains('Option 1').click();

// Wait for stability between interactions
cy.wait(1000);
cy.pfToolbarItem(1).within(() => {
  cy.get('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle').first().click();
});
```

### 4. Form Interactions

```typescript
// Using label-based selection
cy.byLabelText('Instance Name').type('my-instance');
cy.byLabelText('Namespace').select('default');

// Form submission
cy.pfButton('Submit').click();
```

## 🆕 New Distributed Tracing UI Commands

### Menu & Dropdown Interactions

```typescript
// Tempo instance selection
cy.pfTypeahead('Select a Tempo instance').click();
cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

// Service filtering with checkboxes
cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
cy.pfCheckMenuItem('http-rbac-1');
cy.pfCheckMenuItem('http-rbac-2', true);    // Explicitly check
cy.pfCheckMenuItem('grpc-rbac-1', false);   // Uncheck

// Time range selection
cy.pfMenuToggle('Last 30 minutes').click();
cy.pfSelectMenuItem('Last 1 hour').click();
```

### Lightspeed/OLS Integration

```typescript
// Import Lightspeed helpers and selectors
import { olsHelpers, OLS_SELECTORS, OLS_TEXT } from '../views/lightspeed';

// Open and close Lightspeed popover
olsHelpers.openPopover();
olsHelpers.closePopover();

// Wait for popover after Lightspeed operator installation
olsHelpers.waitForPopoverAndClose();        // Default 2 minute timeout
olsHelpers.waitForPopoverAndClose(60000);   // Custom 1 minute timeout

// Send prompts to Lightspeed
olsHelpers.openPopover();
olsHelpers.sendPrompt('Summarize this trace');

// Verify popover content
olsHelpers.verifyPopoverVisible();

// Direct selector access
cy.get(OLS_SELECTORS.popover).should('be.visible');
cy.get(OLS_SELECTORS.mainButton).click();
cy.get(OLS_SELECTORS.minimizeButton).should('exist');
cy.get(OLS_SELECTORS.promptInput).type('Help me understand this error');
```

### Lightspeed API Intercepts

```typescript
// Intercept query requests
cy.interceptQuery(
  'queryAlias',
  'What is causing the slow response time?',
  'conversation-id-123',
  [{ attachment_type: 'trace', content_type: 'application/json' }]
);
cy.wait('@queryAlias');

// Intercept query with error
cy.interceptQueryWithError(
  'errorAlias',
  'Analyze this trace',
  'Service temporarily unavailable'
);
cy.wait('@errorAlias');

// Intercept feedback submission
cy.interceptFeedback(
  'feedbackAlias',
  'conversation-id-123',
  1,                                    // Sentiment: 1 (positive), -1 (negative)
  'Very helpful analysis!',
  'What is causing'                     // User question starts with
);
cy.wait('@feedbackAlias');
```

### Navigation Commands

```typescript
// Breadcrumb navigation
cy.pfBreadcrumb('Traces').click();
cy.pfBreadcrumb('Observability').should('be.visible');

// Close buttons (chip groups, modals, etc.)
cy.pfCloseButton('Close chip group').click();      // PatternFly 5
cy.pfCloseButton('Close label group').click();     // PatternFly 6
cy.pfCloseButton().click();                        // First close button found (any version)
```

### Attribute Filter Interactions

```typescript
// Switch filter type (default is "Service Name")
cy.pfMenuToggle('Service Name').click();
cy.pfSelectMenuItem('Span Name').click();

// Open multi-select checkbox dropdown and select first option
cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
cy.get('.pf-v6-c-menu__item input[type="checkbox"], .pf-v5-c-menu__item input[type="checkbox"]')
  .first()
  .check();

// Switch to Status filter and verify predefined options
cy.pfMenuToggle('Span Name').click();
cy.pfSelectMenuItem('Status').click();
cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
cy.pfCheckMenuItem('unset');
cy.pfCheckMenuItem('error');

// Switch to Span Duration filter with min/max inputs
cy.pfMenuToggle('Status').click();
cy.pfSelectMenuItem('Span Duration').click();
cy.get('#min-duration-input').clear().type('1ms');
cy.wait(1500); // Duration inputs have 1000ms debounce
cy.get('#max-duration-input').clear().type('10s');
cy.wait(1500);

// Verify toolbar chip shows duration range
cy.get('.pf-v6-c-label__content, .pf-v5-c-label__content')
  .should('contain', '1ms')
  .and('contain', '10s');

// Clear filter chip groups
cy.pfCloseButtonIfExists('Close chip group');
cy.pfCloseButtonIfExists('Close label group');
```

### Trace & Span Interactions

```typescript
// Click on traces
cy.muiFirstTraceLink().click();                    // First trace in list
cy.muiTraceLink('http-rbac-2').click();            // Specific service trace

// Interact with span bars
cy.muiFirstSpanBar().click();                      // First span bar
cy.muiSpanBar('http-rbac-2').click();              // Specific service span
cy.findByTestId('span-duration-bar').first().click(); // By test ID (multiple spans)
```

### Trace Attribute Validation

```typescript
// Single attribute validation
cy.muiTraceAttribute('network.peer.address', '1.2.3.4');
cy.muiTraceAttribute('peer.service', 'telemetrygen-client');
cy.muiTraceAttribute('k8s.container.name', 'telemetrygen', true); // Optional attribute

// Custom validation with function
cy.muiTraceAttribute('service.name', (text) => {
  return ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2'].includes(text);
}, false, 'TempoStack'); // Required attribute with logging

// Bulk attribute validation (recommended for multiple attributes)
cy.muiTraceAttributes({
  'network.peer.address': { value: '1.2.3.4' },
  'peer.service': { value: 'telemetrygen-client' },
  'k8s.container.name': { 
    value: 'telemetrygen', 
    optional: true 
  },
  'k8s.namespace.name': { 
    value: (text) => text.startsWith('chainsaw-'),
    optional: true 
  },
  'service.name': { 
    value: ['http-rbac-1', 'http-rbac-2', 'grpc-rbac-1', 'grpc-rbac-2']
  }
}, 'Debug'); // Log prefix for debugging
```

### Complete Workflow Examples

```typescript
// Complete trace inspection workflow
describe('Trace inspection', () => {
  it('should navigate and validate trace details', () => {
    // Navigate to traces page
    cy.visit('/observe/traces');

    // Select Tempo instance
    cy.pfTypeahead('Select a Tempo instance').click();
    cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();

    // Set time range
    cy.pfMenuToggle('Last 30 minutes').click();
    cy.pfSelectMenuItem('Last 1 hour').click();

    // Filter by services
    cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
    cy.pfCheckMenuItem('http-rbac-1');
    cy.pfCheckMenuItem('http-rbac-2');

    // Click first trace
    cy.muiFirstTraceLink().click();

    // Click on span for details
    cy.muiFirstSpanBar().click();

    // Validate trace attributes efficiently
    cy.muiTraceAttributes({
      'network.peer.address': { value: '1.2.3.4' },
      'peer.service': { value: 'telemetrygen-client' },
      'service.name': {
        value: (text) => text.includes('rbac')
      }
    });

    // Navigate back
    cy.pfBreadcrumb('Traces').click();
  });
});

// AI-powered trace analysis with Lightspeed
describe('AI Trace Summary', () => {
  it('should use Lightspeed to analyze trace', () => {
    // Import Lightspeed helpers
    import { olsHelpers, OLS_SELECTORS } from '../views/lightspeed';

    // Navigate to traces page
    cy.visit('/observe/traces');
    cy.get('body').should('be.visible');
    cy.wait(3000);

    // Select instance and filters
    cy.pfTypeahead('Select a Tempo instance').click();
    cy.pfSelectMenuItem('chainsaw-rbac / simplst').click();
    cy.pfTypeahead('Select a tenant').click();
    cy.pfSelectMenuItem('dev').click();

    // Select time range
    cy.muiSelect('Select time range').click();
    cy.muiSelectOption('Last 15 minutes').click();

    // Open first trace
    cy.muiFirstTraceLink().click();

    // Intercept Lightspeed query
    cy.interceptQuery(
      'traceSummary',
      'Summarize this trace',
      null,
      [{ attachment_type: 'trace', content_type: 'application/json' }]
    );

    // Open Lightspeed and request summary
    olsHelpers.openPopover();
    olsHelpers.sendPrompt('Summarize this trace');

    // Wait for AI response
    cy.wait('@traceSummary');

    // Verify response appears
    cy.get(OLS_SELECTORS.popover)
      .should('contain', 'Mock OLS response');

    // Submit feedback
    cy.interceptFeedback(
      'positiveFeedback',
      '5f424596-a4f9-4a3a-932b-46a768de3e7c',
      1,
      'Very helpful!',
      'Summarize this trace'
    );

    // Close popover
    olsHelpers.closePopover();
  });
});
```

### Custom Time Range Selection

```typescript
// Select a preset time range via MUI Select
cy.muiSelect('Select time range').click();
cy.muiSelectOption('Last 1 hour').click();

// Open the custom time range picker
cy.muiSelect('Select time range').click();
cy.muiSelectOption('Custom Time Range').click();

// Verify the DateTimeRangePicker popover opens
cy.contains('.MuiPopover-paper', 'Apply', { timeout: 10000 }).should('be.visible');

// Check popover structure
cy.contains('.MuiPopover-paper', 'Apply').within(() => {
  cy.contains('Select Start Time').should('be.visible');
  cy.get('label').contains('Start Time').should('exist');
  cy.get('label').contains('End Time').should('exist');
});

// Apply the pre-populated custom time range
cy.contains('.MuiPopover-paper', 'Apply').within(() => {
  cy.get('button.MuiButton-contained').contains('Apply').click();
});

// Cancel the custom time range
cy.contains('.MuiPopover-paper', 'Apply').within(() => {
  cy.get('button.MuiButton-outlined').contains('Cancel').click();
});

// Verify URL params after custom range apply
cy.url().should('match', /start=\d+/);   // Absolute timestamp
cy.url().should('match', /end=\d+/);

// Verify URL params after preset selection
cy.url().should('include', 'start=1h');   // Relative duration
```

### Scatter Plot Interactions

```typescript
// Verify scatter plot is rendered with ECharts
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"]').should('be.visible');
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas').should('exist');
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] > div')
  .should('have.attr', '_echarts_instance_');

// Toggle scatter plot visibility
cy.contains('button', 'Hide graph').click();
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"]').should('not.exist');
cy.contains('button', 'Show graph').click();
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"]').should('be.visible');

// Trigger tooltip via mousemove on canvas
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas').first()
  .trigger('mousemove', 'center', { force: true });

// Validate canvas has rendered content (non-empty pixels)
cy.get('[data-testid="ScatterChartPanel_ScatterPlot"] canvas').first().then(($canvas) => {
  const canvas = $canvas[0] as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hasContent = imageData.data.some((val, idx) => idx % 4 !== 3 && val !== 0);
  expect(hasContent).to.be.true;
});
```

### Chainsaw & TLS Verification

```typescript
// Run a single chainsaw test directory (path relative to fixtures/chainsaw-tests/)
cy.runChainsawTest('tls-profile-modern', 'Modern TLS profile');

// Run multiple chainsaw test directories
cy.runChainsawTest(
  ['multitenancy-rbac', 'monolithic-multitenancy-rbac'],
  'Create TempoStack and TempoMonolithic instances',
  { timeout: 1200000 },
);

// Run a chainsaw test from a custom path (starts with ./)
cy.runChainsawTest(
  './fixtures/lightspeed',
  'Lightspeed setup',
  {
    timeout: 1800000,
    extraArgs: '--values - <<EOF\nKEY: value\nEOF',
  },
);

// Verify traces are visible in the UI for a given Tempo instance and tenant
cy.verifyTracesVisible('chainsaw-rbac / simplst', 'dev');
```

## 🔄 PatternFly 5 & 6 Compatibility

Our commands seamlessly support both PatternFly 5 and PatternFly 6 components:

### Close Buttons

```typescript
// PatternFly 5 - Chip Group
// <button aria-label="Close chip group" class="pf-v5-c-button pf-m-plain">
cy.pfCloseButton('Close chip group').click();

// PatternFly 6 - Label Group  
// <button aria-label="Close label group" class="pf-v6-c-button pf-m-plain pf-m-no-padding">
cy.pfCloseButton('Close label group').click();

// Works with both versions automatically
cy.pfCloseButton('Close').click();  // Finds any close button
```

### Menu Components

```typescript
// Both PF5 and PF6 menu structures supported
cy.pfMenuToggle('Select Instance').click();     // Works with .pf-v5-c-menu-toggle or .pf-v6-c-menu-toggle
cy.pfSelectMenuItem('tempo-stack').click();     // Works with .pf-v5-c-menu__item or .pf-v6-c-menu__item
cy.pfCheckMenuItem('service-name');             // Handles both PF5/PF6 checkbox patterns
```

### Button Components

```typescript
// PatternFly button targeting (version-agnostic)
cy.pfButton('Create Instance').click();         // Targets .pf-v5-c-button or .pf-v6-c-button
cy.pfEmptyState().should('be.visible');         // Works with both .pf-v5-c-empty-state and .pf-v6-c-empty-state
```

### Key Benefits

- ✅ **Automatic detection** - Commands work with both PF5 and PF6 automatically
- ✅ **Future-proof** - Ready for PatternFly version upgrades
- ✅ **Consistent API** - Same command syntax across versions
- ✅ **Robust selectors** - Uses semantic attributes over version-specific classes

## 🛡️ Defensive Programming Patterns

### 1. Check Element Existence

```typescript
// Safe menu interaction
cy.get('body').then(($body) => {
  if ($body.find('.pf-v6-c-menu-toggle:contains("Actions")').length > 0) {
    cy.pfMenuToggle('Actions').click();
    if ($body.find('.pf-v6-c-menu__item:contains("Delete")').length > 0) {
      cy.pfMenuItem('Delete').click();
    }
  }
});
```

### 2. Wait for Stability

```typescript
// Wait for page load and React hydration
cy.visit('/traces');
cy.wait(2000); // Allow initial React state to settle

// Perform interactions
cy.pfEmptyState().should('be.visible');
cy.pfButton('Create Instance').click();
```

### 3. Use Timeouts

```typescript
// Custom timeouts for slow-loading components
cy.pfMenuToggle('Select Instance', { timeout: 15000 }).click();
cy.pfMenuItem('TempoStack', { timeout: 10000 }).click();
```

## 🎯 Best Practices Summary

1. **Add waits between complex interactions** to let React state stabilize
2. **Use defensive checks** for dynamic content
3. **Prefer direct PatternFly commands** over complex CSS selectors
4. **Break complex operations** into smaller, testable steps
5. **Handle uncaught exceptions** gracefully in support files
6. **Use timeouts** for components that load asynchronously

### OCP Version Compatibility

```typescript
// Dismiss the OCP 4.22+ "Welcome to the new OpenShift experience!" modal
// Call after cy.visit() to any page — no-op on older OCP versions
cy.dismissWelcomeModal();

// Typical usage pattern after navigating to a page
cy.visit('/observe/traces');
cy.url().should('include', '/observe/traces');
cy.dismissWelcomeModal();
cy.get('body').should('be.visible');
```

## 🔧 Troubleshooting

If you encounter "e is not a function" errors:

1. **Add `cy.wait(1000-2000)`** between interactions
2. **Check if elements exist** before interacting
3. **Use more specific selectors** instead of nth-child
4. **Verify React components have finished rendering**
5. **Review browser console** for additional React errors

These patterns will make your tests more reliable and less prone to React state management issues. 