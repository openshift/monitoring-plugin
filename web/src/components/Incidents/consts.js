import * as React from 'react';
import { SelectOption } from '@patternfly/react-core';
import { DropdownItem as DropdownItemDeprecated } from '@patternfly/react-core/deprecated';

export const incidentTypeMenuItems = (filters) => [
  <SelectOption
    key="longStanding"
    value="Long standing"
    isSelected={filters.incidentType.includes('Long standing')}
    description="The incident has been firing for at least 7 days."
  />,
  <SelectOption
    key="informative"
    value="Informative"
    isSelected={filters.incidentType.includes('Informative')}
    description="The incident is not critical."
  />,
  <SelectOption
    key="inactive"
    value="Inactive"
    isSelected={filters.incidentType.includes('Inactive')}
    description="The incident is not currently firing."
  />,
];

export const daysMenuItems = (filters) => [
  <SelectOption key="1-day-filter" value="1 day" isSelected={filters.days.includes('1d')} />,
  <SelectOption key="3-day-filter" value="3 days" isSelected={filters.days.includes('3d')} />,
  <SelectOption key="7-day-filter" value="7 days" isSelected={filters.days.includes('7d')} />,
  <SelectOption key="15-day-filter" value="15 days" isSelected={filters.days.includes('15d')} />,
];

export const dropdownItems = (changeDaysFilter, t) => [
  <DropdownItemDeprecated
    key="1-day-filter"
    component="button"
    onClick={() => changeDaysFilter('1 day')}
  >
    {t('1 day')}
  </DropdownItemDeprecated>,
  <DropdownItemDeprecated
    key="3-day-filter"
    component="button"
    onClick={() => changeDaysFilter('3 days')}
  >
    {t('3 days')}
  </DropdownItemDeprecated>,
  <DropdownItemDeprecated
    key="7-day-filter"
    component="button"
    onClick={() => changeDaysFilter('7 days')}
  >
    {t('7 days')}
  </DropdownItemDeprecated>,
  <DropdownItemDeprecated
    key="15-day-filter"
    component="button"
    onClick={() => changeDaysFilter('15 days')}
  >
    {t('15 days')}
  </DropdownItemDeprecated>,
];
