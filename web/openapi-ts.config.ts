import { defineConfig } from '@hey-api/openapi-ts';

// Regenerates the Korrel8r client with `npm run generate-korrel8r-client`.
export default defineConfig({
  input: 'src/features/troubleshooting/korrel8r/korrel8r-openapi.yaml',
  output: {
    path: 'src/features/troubleshooting/korrel8r/client',
    postProcess: ['prettier'],
  },
});
