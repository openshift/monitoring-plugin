import * as React from 'react';
import { DropdownItem } from '@patternfly/react-core';

export const incidentsTableColumns = (t) => [
  {
    id: 'component',
    title: t('Component'),
  },
  {
    id: 'severity',
    title: t('Severity'),
  },
  {
    id: 'state',
    title: t('State'),
  },
];

export const dropdownItems = (changeDaysFilter, t) => [
  <DropdownItem key="1-day-filter" component="button" onClick={() => changeDaysFilter('1d')}>
    {t('1 day')}
  </DropdownItem>,
  <DropdownItem key="3-day-filter" component="button" onClick={() => changeDaysFilter('3d')}>
    {t('3 days')}
  </DropdownItem>,
  <DropdownItem key="7-day-filter" component="button" onClick={() => changeDaysFilter('7d')}>
    {t('7 days')}
  </DropdownItem>,
  <DropdownItem key="15-day-filter" component="button" onClick={() => changeDaysFilter('15d')}>
    {t('15 days')}
  </DropdownItem>,
];
