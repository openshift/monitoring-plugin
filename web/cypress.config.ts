import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:9003',
    defaultCommandTimeout: 30000,
    supportFile: 'cypress/support/index.ts',
    viewportHeight: 1080,
    viewportWidth: 1920,
  },
});
