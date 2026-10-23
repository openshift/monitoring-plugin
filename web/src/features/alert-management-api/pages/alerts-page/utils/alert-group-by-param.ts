import { createEnumParam, withDefault } from 'use-query-params';

import { AlertGroupBy } from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';

export const AlertGroupByParam = withDefault(
  createEnumParam<AlertGroupBy>(Object.values(AlertGroupBy)),
  AlertGroupBy.None,
);
