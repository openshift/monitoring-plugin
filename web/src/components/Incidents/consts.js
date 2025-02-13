import * as React from 'react';
import { SelectOption, MenuItem } from '@patternfly/react-core';

export const incidentFiltersMenuItems = (filters) => [
  <MenuItem
    key="critical"
    itemId="Critical"
    isSelected={filters.incidentFilters.includes('Critical')}
    description="The incident is critical."
    hasCheckbox
  >
    Critical
  </MenuItem>,
  <MenuItem
    key="warning"
    itemId="Warning"
    isSelected={filters.incidentFilters.includes('Warning')}
    description="The incident might lead to critical."
    hasCheckbox
  >
    Warning
  </MenuItem>,
  <MenuItem
    key="informative"
    itemId="Informative"
    isSelected={filters.incidentFilters.includes('Informative')}
    description="The incident is not critical."
    hasCheckbox
  >
    Informative
  </MenuItem>,
  <MenuItem
    key="firing"
    itemId="Firing"
    isSelected={filters.incidentFilters.includes('Firing')}
    description="The incident is currently firing."
    hasCheckbox
  >
    Firing
  </MenuItem>,
  <MenuItem
    key="inactive"
    itemId="Resolved"
    isSelected={filters.incidentFilters.includes('Resolved')}
    description="The incident is not currently firing."
    hasCheckbox
  >
    Resolved
  </MenuItem>,
];

export const dropdownItems = (t) => [
  <SelectOption key="1-day-filter" value="1 day">
    {t('1 day')}
  </SelectOption>,
  <SelectOption key="3-day-filter" value="3 days">
    {t('3 days')}
  </SelectOption>,
  <SelectOption key="7-day-filter" value="7 days">
    {t('7 days')}
  </SelectOption>,
  <SelectOption key="15-day-filter" value="15 days">
    {t('15 days')}
  </SelectOption>,
];
