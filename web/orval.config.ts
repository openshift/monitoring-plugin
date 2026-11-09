import { defineConfig } from 'orval';

export default defineConfig({
  alertManagement: {
    hooks: {
      afterAllFilesWrite: ['eslint --fix', 'prettier --write'],
    },
    input: '../api/openapi.yaml',
    output: {
      target: './src/shared/clients/alert-management-api/generated/api.ts',
      client: 'react-query',
      httpClient: 'fetch',
      // base url and fetch are configured in transport.ts
      baseUrl: '',
      clean: true,
      tsconfig: './tsconfig.json',
      urlEncodeParameters: true,
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: '@/shared/clients/alert-management-api/transport',
          name: 'alertManagementFetch',
        },
        query: {
          version: 4,
          signal: true,
          mutationOptions: {
            path: '@/shared/clients/alert-management-api/mutation-options',
            name: 'alertManagementMutationOptions',
          },
        },
      },
    },
  },
});
