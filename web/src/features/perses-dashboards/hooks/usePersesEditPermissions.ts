import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';

export const usePersesEditPermissions = (namespace: string | null = null) => {
  const [canCreate, createLoading] = useAccessReview({
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb: 'create',
    namespace,
  });

  const [canUpdate, updateLoading] = useAccessReview({
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb: 'update',
    namespace,
  });

  const [canDelete, deleteLoading] = useAccessReview({
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb: 'delete',
    namespace,
  });

  const loading = createLoading || updateLoading || deleteLoading;
  const canEdit = canUpdate && canCreate && canDelete;

  return { canEdit, loading };
};
