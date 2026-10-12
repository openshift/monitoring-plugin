import { namespaceBelongsToInfrastructureTenant } from '@/features/logging/value-utils';

describe('Data source utilities', () => {
  describe('namespaceBelongsToInfrastructureTenant', () => {
    it('should return true for infrastructure namespaces', () => {
      const infrastructureNamespaces = [
        'openshift',
        'openshift-apiserver',
        'openshift-logging',
        'openshift-monitoring',
        'default',
        'kube-system',
        'kube-public',
      ];

      infrastructureNamespaces.forEach((namespace) => {
        expect(namespaceBelongsToInfrastructureTenant(namespace)).toBe(true);
      });
    });

    it('should return false for application namespaces', () => {
      const applicationNamespaces = [
        'my-app',
        'gitops',
        'production',
        'staging',
        'development',
        'user-namespace',
      ];

      applicationNamespaces.forEach((namespace) => {
        expect(namespaceBelongsToInfrastructureTenant(namespace)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(namespaceBelongsToInfrastructureTenant('')).toBe(false);
      expect(namespaceBelongsToInfrastructureTenant('openshift-')).toBe(true);
      expect(namespaceBelongsToInfrastructureTenant('kube-')).toBe(true);
    });
  });

  describe('Tenant filtering for admin view', () => {
    it('should correctly filter namespaces for infrastructure tenant', () => {
      const allNamespaces = [
        { metadata: { name: 'openshift-logging' } },
        { metadata: { name: 'openshift-monitoring' } },
        { metadata: { name: 'default' } },
        { metadata: { name: 'kube-system' } },
        { metadata: { name: 'my-app' } },
        { metadata: { name: 'gitops' } },
      ];

      const infrastructureFilter = (resource: { metadata?: { name?: string } }) =>
        namespaceBelongsToInfrastructureTenant(resource.metadata?.name || '');

      const filtered = allNamespaces.filter(infrastructureFilter);

      expect(filtered.length).toBe(4);
      expect(filtered.map((r) => r.metadata.name)).toEqual([
        'openshift-logging',
        'openshift-monitoring',
        'default',
        'kube-system',
      ]);
    });

    it('should correctly filter namespaces for application tenant', () => {
      const allNamespaces = [
        { metadata: { name: 'openshift-logging' } },
        { metadata: { name: 'openshift-monitoring' } },
        { metadata: { name: 'default' } },
        { metadata: { name: 'kube-system' } },
        { metadata: { name: 'my-app' } },
        { metadata: { name: 'gitops' } },
      ];

      const applicationFilter = (resource: { metadata?: { name?: string } }) =>
        !namespaceBelongsToInfrastructureTenant(resource.metadata?.name || '');

      const filtered = allNamespaces.filter(applicationFilter);

      expect(filtered.length).toBe(2);
      expect(filtered.map((r) => r.metadata.name)).toEqual(['my-app', 'gitops']);
    });
  });

  describe('Container options mapping', () => {
    it('should map Loki series data to pod/container format', () => {
      const seriesData = [
        {
          kubernetes_pod_name: 'my-pod-1',
          kubernetes_container_name: 'container-a',
        },
        {
          kubernetes_pod_name: 'my-pod-1',
          kubernetes_container_name: 'container-b',
        },
        {
          kubernetes_pod_name: 'my-pod-2',
          kubernetes_container_name: 'container-c',
        },
      ];

      const containerLabel = 'kubernetes_container_name';
      const podLabel = 'kubernetes_pod_name';

      const uniqueContainers = new Set<string>();
      seriesData.forEach((item) => {
        if (item[containerLabel] && item[podLabel]) {
          uniqueContainers.add(`${item[podLabel]} / ${item[containerLabel]}`);
        }
      });

      const options = Array.from(uniqueContainers).map((container) => ({
        option: container,
        value: container,
      }));

      expect(options).toEqual([
        { option: 'my-pod-1 / container-a', value: 'my-pod-1 / container-a' },
        { option: 'my-pod-1 / container-b', value: 'my-pod-1 / container-b' },
        { option: 'my-pod-2 / container-c', value: 'my-pod-2 / container-c' },
      ]);
    });

    it('should handle OTEL schema labels', () => {
      const seriesData = [
        {
          k8s_pod_name: 'otel-pod-1',
          k8s_container_name: 'otel-container',
        },
      ];

      const containerLabel = 'k8s_container_name';
      const podLabel = 'k8s_pod_name';

      const uniqueContainers = new Set<string>();
      seriesData.forEach((item) => {
        if (item[containerLabel] && item[podLabel]) {
          uniqueContainers.add(`${item[podLabel]} / ${item[containerLabel]}`);
        }
      });

      const options = Array.from(uniqueContainers).map((container) => ({
        option: container,
        value: container,
      }));

      expect(options).toEqual([
        { option: 'otel-pod-1 / otel-container', value: 'otel-pod-1 / otel-container' },
      ]);
    });

    it('should skip items with missing pod or container labels', () => {
      const seriesData = [
        {
          kubernetes_pod_name: 'my-pod',
          kubernetes_container_name: 'my-container',
        },
        {
          kubernetes_pod_name: 'incomplete-pod',
          // missing container
        },
        {
          // missing pod
          kubernetes_container_name: 'incomplete-container',
        },
        {
          kubernetes_pod_name: '',
          kubernetes_container_name: 'empty-pod',
        },
      ];

      const containerLabel = 'kubernetes_container_name';
      const podLabel = 'kubernetes_pod_name';

      const uniqueContainers = new Set<string>();
      seriesData.forEach((item: Record<string, string | undefined>) => {
        if (item[containerLabel] && item[podLabel]) {
          uniqueContainers.add(`${item[podLabel]} / ${item[containerLabel]}`);
        }
      });

      const options = Array.from(uniqueContainers).map((container) => ({
        option: container,
        value: container,
      }));

      expect(options).toEqual([
        { option: 'my-pod / my-container', value: 'my-pod / my-container' },
      ]);
    });
  });

  describe('Project/Namespace options formatting', () => {
    it('should format project list response items correctly', () => {
      const projectItems = [
        { metadata: { name: 'project-a' } },
        { metadata: { name: 'project-b' } },
        { metadata: { name: 'project-c' } },
      ];

      const options = projectItems.map((project) => ({
        option: project?.metadata?.name ?? '',
        value: project?.metadata?.name ?? '',
      }));

      expect(options).toEqual([
        { option: 'project-a', value: 'project-a' },
        { option: 'project-b', value: 'project-b' },
        { option: 'project-c', value: 'project-c' },
      ]);
    });

    it('should filter out items with empty names', () => {
      const projectItems = [
        { metadata: { name: 'valid-project' } },
        { metadata: { name: '' } },
        { metadata: {} },
      ];

      const options = projectItems
        .map((project) => ({
          option: project?.metadata?.name ?? '',
          value: project?.metadata?.name ?? '',
        }))
        .filter(({ value }) => value !== '');

      expect(options).toEqual([{ option: 'valid-project', value: 'valid-project' }]);
    });
  });

  describe('Pod label values formatting', () => {
    it('should format Loki label values correctly', () => {
      const labelValuesResponse = {
        data: ['pod-1', 'pod-2', 'pod-3'],
      };

      const uniqueValues = new Set<string>(labelValuesResponse.data);
      const sortedValues = Array.from(uniqueValues).sort();

      const options = sortedValues.map((label) => ({
        option: label,
        value: label,
      }));

      expect(options).toEqual([
        { option: 'pod-1', value: 'pod-1' },
        { option: 'pod-2', value: 'pod-2' },
        { option: 'pod-3', value: 'pod-3' },
      ]);
    });

    it('should deduplicate values', () => {
      const labelValuesResponse = {
        data: ['pod-1', 'pod-2', 'pod-1', 'pod-3', 'pod-2'],
      };

      const uniqueValues = new Set<string>(labelValuesResponse.data);
      const sortedValues = Array.from(uniqueValues).sort();

      expect(sortedValues).toEqual(['pod-1', 'pod-2', 'pod-3']);
    });

    it('should sort values alphabetically', () => {
      const labelValuesResponse = {
        data: ['zebra-pod', 'alpha-pod', 'middle-pod'],
      };

      const uniqueValues = new Set<string>(labelValuesResponse.data);
      const sortedValues = Array.from(uniqueValues).sort();

      expect(sortedValues).toEqual(['alpha-pod', 'middle-pod', 'zebra-pod']);
    });
  });
});
