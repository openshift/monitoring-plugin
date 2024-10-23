import * as React from 'react';
import { DropdownItem, SelectOption } from '@patternfly/react-core';

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

export const statusMenuItems = (filters) => [
  <SelectOption
    key="longStanding"
    value="Long standing"
    isSelected={filters.incidentType.includes('Long standing')}
  />,
  <SelectOption
    key="informative"
    value="Informative"
    isSelected={filters.incidentType.includes('Informative')}
  />,
  <SelectOption
    key="inactive"
    value="Inactive"
    isSelected={filters.incidentType.includes('Inactive')}
  />,
];

export const daysMenuItems = (filters) => [
  <SelectOption key="1-day-filter" value="1 day" isSelected={filters.days.includes('1d')} />,
  <SelectOption key="3-day-filter" value="3 days" isSelected={filters.days.includes('3d')} />,
  <SelectOption key="7-day-filter" value="7 days" isSelected={filters.days.includes('7d')} />,
  <SelectOption key="15-day-filter" value="15 days" isSelected={filters.days.includes('15d')} />,
];
