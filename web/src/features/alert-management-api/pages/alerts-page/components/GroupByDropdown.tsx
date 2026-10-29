import { Dropdown, DropdownItem, DropdownList, Flex, MenuToggle } from '@patternfly/react-core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryParam } from 'use-query-params';

import { AlertGroupByParam } from '@/features/alert-management-api/pages/alerts-page/utils/alert-group-by-param';
import { AlertGroupBy } from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import { QueryParams } from '@/shared/constants/query-params';

const groupByLabels = {
  [AlertGroupBy.None]: 'None',
  [AlertGroupBy.Severity]: 'Severity',
  [AlertGroupBy.Scope]: 'Alert scope',
  [AlertGroupBy.Component]: 'Component',
} as const;

export function GroupByDropdown() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [groupBy, setGroupBy] = useQueryParam(QueryParams.GroupBy, AlertGroupByParam);
  const [isOpen, setOpen] = useState(false);

  return (
    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
      <span>{t('Group by')}</span>
      <Dropdown
        isOpen={isOpen}
        onOpenChange={setOpen}
        onSelect={() => setOpen(false)}
        toggle={(ref) => (
          <MenuToggle
            ref={ref}
            variant="plainText"
            isExpanded={isOpen}
            aria-label={t('Group by')}
            onClick={() => setOpen((open) => !open)}
          >
            {t(groupByLabels[groupBy])}
          </MenuToggle>
        )}
      >
        <DropdownList>
          {Object.values(AlertGroupBy).map((value) => (
            <DropdownItem
              key={value}
              isSelected={groupBy === value}
              onClick={() => setGroupBy(value === AlertGroupBy.None ? undefined : value)}
            >
              {t(groupByLabels[value])}
            </DropdownItem>
          ))}
        </DropdownList>
      </Dropdown>
    </Flex>
  );
}
