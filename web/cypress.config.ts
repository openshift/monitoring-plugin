import { defineConfig } from 'cypress';
import * as fs from 'fs-extra';
import * as console from 'console';
import * as path from 'path';

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
    TIMEZONE: process.env.CYPRESS_TIMEZONE || 'UTC',
    MOCK_NEW_METRICS: process.env.CYPRESS_MOCK_NEW_METRICS || 'false',
    COO_NAMESPACE: process.env.CYPRESS_COO_NAMESPACE || 'openshift-cluster-observability-operator',
    typeDelay: 200,
  },
  fixturesFolder: 'cypress/fixtures',
  defaultCommandTimeout: 80000, //due to performance loading issue on console
  readyTimeoutMilliseconds: 120000,
  installTimeoutMilliseconds: 600000,
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
         clearDownloads(folder: string = config.downloadsFolder): null {
          // You must return a value or a promise from a task.
          // Returning null is a common practice for tasks that don't need to yield a value.
          console.log(`Clearing downloads folder: ${folder}`);
          fs.emptyDirSync(folder);
          return null;
        },
        /**
         * Checks if a file exists in the specified folder (defaults to downloads folder).
         * @param args Object containing fileName and optional folder.
         * @returns True if the file exists, false otherwise.
         */
        doesFileExist({ fileName, folder = config.downloadsFolder }: { fileName: string; folder?: string }): boolean {
          const filePath = path.join(folder, fileName);
          const exists = fs.existsSync(filePath);
          console.log(`Checking if file "${fileName}" exists at "${filePath}": ${exists}`);
          return exists;
        },

        /**
         * Gets a list of file names in the specified folder (defaults to downloads folder).
         * @param folder The folder to list files from.
         * @returns An array of file names.
         */
        getFilesInFolder(folder: string = config.downloadsFolder): string[] {
          if (!fs.existsSync(folder)) {
            console.log(`Folder does not exist: ${folder}`);
            return [];
          }
          const files = fs.readdirSync(folder);
          console.log(`Files in "${folder}": ${files.join(', ')}`);
          return files;
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
    downloadsFolder: './cypress/downloads',
    numTestsKeptInMemory: 1,
    testIsolation: false,
    experimentalModifyObstructiveThirdPartyCode: true,
    experimentalOriginDependencies: true,
    experimentalMemoryManagement: true,
    experimentalStudio: true,
  },
});