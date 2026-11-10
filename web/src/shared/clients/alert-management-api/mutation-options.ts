import type { UseMutationOptions } from '@tanstack/react-query';

// A failed combined update may already have persisted classification changes.
// Override QueryClient defaults and caller options: mutations must not auto-replay.
export const alertManagementMutationOptions = <TData, TError, TVariables, TContext>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationOptions<TData, TError, TVariables, TContext> => ({
  ...options,
  retry: false,
});
