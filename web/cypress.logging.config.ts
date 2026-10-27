import { defineConfig } from 'cypress';

export default defineConfig({
  screenshotsFolder: 'cypress/screenshots/logging',
  videosFolder: 'cypress/videos/logging',
  video: false,
  viewportWidth: 1400,
  viewportHeight: 1200,
  defaultCommandTimeout: 30000,
  e2e: {
    baseUrl: 'http://localhost:9003',
    specPattern: 'cypress/logging/integration/*.cy.ts',
    supportFile: 'cypress/logging/support.ts',
    testIsolation: false,
  },
});
