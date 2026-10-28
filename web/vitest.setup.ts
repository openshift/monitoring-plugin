import { SERVER_FLAGS } from './src/shared/test-utils/server-flags';

// Globally mock the SDK: pass through the real `common-types` and supply the
// runtime values for the SDK's `const enum`s
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
}));

if (typeof window === 'undefined') {
  global.window = { SERVER_FLAGS } as Window & typeof globalThis;
} else {
  window.SERVER_FLAGS = SERVER_FLAGS;
}
