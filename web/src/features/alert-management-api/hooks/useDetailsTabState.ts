import { NumberParam, useQueryParam } from 'use-query-params';

import { QueryParams } from '@/shared/constants/query-params';

export function useDetailsTabState(tabCount: number) {
  const [tab, setTab] = useQueryParam(QueryParams.Tab, NumberParam);
  const activeTab = Number.isInteger(tab) && tab >= 0 && tab < tabCount ? tab : 0;

  return { activeTab, setActiveTab: setTab };
}
