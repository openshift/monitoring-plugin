import type { Mock } from 'vitest';
vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({ K8sResourceCommon: {} }));
vi.mock('@/features/logging/cancellable-fetch', () => ({ cancellableFetch: vi.fn() }));
vi.mock('@/features/logging/loki-client', () => ({
  executeLabelValue: vi.fn(),
  executeSeries: vi.fn(),
}));

import { availableDevConsoleAttributes } from '@/features/logging/AttributeFilters';
import { cancellableFetch } from '@/features/logging/cancellable-fetch';
import { Option } from '@/features/logging/components/filters/filter-types';
import { Config, Schema } from '@/features/logging/logs-types';
import { executeLabelValue } from '@/features/logging/loki-client';

const mockCancellableFetch = cancellableFetch as Mock;
const mockExecuteLabelValue = executeLabelValue as Mock;

const getNamespaceOptionsFn = (namespace?: string): (() => Promise<Option[]>) => {
  const attributes = availableDevConsoleAttributes(
    'application',
    {} as Config,
    Schema.viaq,
    namespace,
  );
  const namespaceAttribute = attributes.find((attribute) => attribute.id === 'namespace');
  return namespaceAttribute?.options as () => Promise<Option[]>;
};

const getNamespaceOptions = async (namespace: string): Promise<string[]> => {
  const options = await getNamespaceOptionsFn(namespace)();
  return options.map((option) => option.value);
};

describe('Developer view namespace options (OU-578)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes namespaces the user has Loki log access to but does not own as a project', async () => {
    // Projects API returns only the owned project...
    mockCancellableFetch.mockReturnValue({
      request: () => Promise.resolve({ items: [{ metadata: { name: 'owned-ns' } }] }),
      abort: vi.fn(),
    });
    // ...while Loki exposes an extra namespace the user has log access to.
    mockExecuteLabelValue.mockReturnValue({
      request: () => Promise.resolve({ data: ['owned-ns', 'granted-ns'] }),
      abort: vi.fn(),
    });

    const values = await getNamespaceOptions('owned-ns');

    expect(values).toContain('owned-ns');
    expect(values).toContain('granted-ns');
  });

  it('still lists projects when the Loki label values query fails', async () => {
    mockCancellableFetch.mockReturnValue({
      request: () => Promise.resolve({ items: [{ metadata: { name: 'owned-ns' } }] }),
      abort: vi.fn(),
    });
    mockExecuteLabelValue.mockReturnValue({
      request: () => Promise.reject(new Error('forbidden')),
      abort: vi.fn(),
    });

    const values = await getNamespaceOptions('owned-ns');

    expect(values).toEqual(['owned-ns']);
  });

  it('includes the active namespace when projects is empty and Loki label values are forbidden', async () => {
    // Pure fine-grained access: no owned projects and the Loki gateway 403s the
    // unscoped label-values request, so only the active namespace remains (OU-578).
    mockCancellableFetch.mockReturnValue({
      request: () => Promise.resolve({ items: [] }),
      abort: vi.fn(),
    });
    mockExecuteLabelValue.mockReturnValue({
      request: () => Promise.reject(new Error("You don't have permission to access this tenant")),
      abort: vi.fn(),
    });

    const values = await getNamespaceOptions('test-1');

    expect(values).toEqual(['test-1']);
  });

  it('surfaces the error when both sources fail and there is no seed namespace', async () => {
    // Admin logs view passes no seed. A total enumeration failure must reject so
    // the caller can show an error, not resolve to a silent empty dropdown.
    mockCancellableFetch.mockReturnValue({
      request: () => Promise.reject(new Error('projects forbidden')),
      abort: vi.fn(),
    });
    mockExecuteLabelValue.mockReturnValue({
      request: () => Promise.reject(new Error('loki forbidden')),
      abort: vi.fn(),
    });

    await expect(getNamespaceOptionsFn()()).rejects.toThrow('projects forbidden');
  });
});
