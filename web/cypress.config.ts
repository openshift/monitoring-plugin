
// import { defineConfig } from "cypress";

// export default defineConfig({
//   e2e: {
//     baseUrl: 'http://localhost:9000',
//     defaultCommandTimeout: 30000,
//     supportFile: 'cypress/support/index.ts',
//     viewportHeight: 1080,
//     viewportWidth: 1920,
//   },
// });


import { defineConfig } from 'cypress';
import * as fs from 'fs';
import * as console from 'console';

export default defineConfig({
  screenshotsFolder: './cypress/screenshots',
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  videosFolder: './cypress/videos',
  video: true,
  videoCompression: false,
  reporter: './node_modules/cypress-multi-reporters',
  reporterOptions: {
    configFile: 'reporter-config.json',
  },
  env: {
    grepFilterSpecs: true,
    HOST_API: process.env.CYPRESS_BASE_URL.replace(/console-openshift-console.apps/, 'api').concat(
      ':6443',
    ),
    LOGIN_USERNAME: process.env.CYPRESS_LOGIN_USERS.split(',')[0].split(':')[0],
    LOGIN_PASSWORD: process.env.CYPRESS_LOGIN_USERS.split(',')[0].split(':')[1],
  },
  fixturesFolder: 'fixtures',
  defaultCommandTimeout: 60000, //due to performance loading issue on console
  retries: {
    runMode: 0,
    openMode: 0,
  },
  e2e: {
    browser: "chrome",
    viewportWidth: 1920,
    viewportHeight: 1080,
    setupNodeEvents(on, config) {
      on(
        'before:browser:launch',
        (
          browser = {
            name: '',
            family: 'chromium',
            channel: '',
            displayName: '',
            version: '',
            majorVersion: '',
            path: '',
            isHeaded: false,
            isHeadless: false,
          },
          launchOptions,
        ) => {
          if (browser.family === 'chromium' && browser.name !== 'electron') {
            // Auto open devtools
            launchOptions.args.push('--enable-precise-memory-info');
            // Add flags for headless/container stability:
            launchOptions.args.push('--disable-gpu'); // Often necessary for headless
            launchOptions.args.push('--no-sandbox'); // Often needed in containers, understand security implications
            launchOptions.args.push('--disable-dev-shm-usage'); // Crucial for Docker to prevent crashes
            launchOptions.args.push('--window-size=1920,1080');
          }

          return launchOptions;
        },
      );
      // `on` is used to hook into various events Cypress emits
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        logError(message) {
          console.error(message);
          return null;
        },
        logTable(data) {
          console.table(data);
          return null;
        },
        readFileIfExists(filename) {
          if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8');
          }
          return null;
        },
      });
      on('after:spec', (spec: Cypress.Spec, results: CypressCommandLine.RunResult) => {
        if (results && results.video) {
          // Do we have failures for any retry attempts?
          const failures = results.tests.some((test) =>
            test.attempts.some((attempt) => attempt.state === 'failed'),
          );
          if (!failures && fs.existsSync(results.video)) {
            // Delete the video if the spec passed and no tests retried
            fs.unlinkSync(results.video);
          }
        }
      });
      return config;
    },
    supportFile: './cypress/support/index.ts',
    specPattern: './cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    numTestsKeptInMemory: 1,
    testIsolation: false,
    experimentalModifyObstructiveThirdPartyCode: true,
    experimentalOriginDependencies: true,
    experimentalMemoryManagement: true,
    experimentalStudio: true,
  },
});