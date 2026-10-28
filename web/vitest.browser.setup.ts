import '@patternfly/react-core/dist/styles/base.css';
import { afterEach, vi } from 'vitest';
import { cleanup } from 'vitest-browser-react';

import { SERVER_FLAGS } from './src/shared/test-utils/server-flags';

if (typeof window === 'undefined') {
  global.window = { SERVER_FLAGS } as Window & typeof globalThis;
} else {
  window.SERVER_FLAGS = SERVER_FLAGS;
}

afterEach(cleanup);

vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types')),
  ...(await vi.importActual('./src/shared/test-utils/sdk-const-enums')),
  RedExclamationCircleIcon: (await import('@patternfly/react-icons')).RhUiErrorFillIcon,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      Object.entries(options ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
        key,
      ),
  }),
}));
