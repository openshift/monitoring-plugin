import * as React from 'react';
import { SelectOption } from '@patternfly/react-core';
import { DropdownItem as DropdownItemDeprecated } from '@patternfly/react-core/deprecated';
import { changeDaysFilter } from './utils';

export const incidentFiltersMenuItems = (filters) => [
  <SelectOption
    key="Long standing"
    value="Long standing"
    isSelected={filters.incidentFilters.includes('Long standing')}
    description="The incident has been firing for at least 7 days."
    hasCheckbox
  >
    Long standing
  </SelectOption>,
  <SelectOption
    key="critical"
    value="Critical"
    isSelected={filters.incidentFilters.includes('Critical')}
    description="The incident is critical."
    hasCheckbox
  >
    Critical
  </SelectOption>,
  <SelectOption
    key="warning"
    value="Warning"
    isSelected={filters.incidentFilters.includes('Warning')}
    description="The incident might lead to critical."
    hasCheckbox
  >
    Warning
  </SelectOption>,
  <SelectOption
    key="informative"
    value="Informative"
    isSelected={filters.incidentFilters.includes('Informative')}
    description="The incident is not critical."
    hasCheckbox
  >
    Informative
  </SelectOption>,
  <SelectOption
    key="firing"
    value="Firing"
    isSelected={filters.incidentFilters.includes('Firing')}
    description="The incident is currently firing."
    hasCheckbox
  >
    Firing
  </SelectOption>,
  <SelectOption
    key="inactive"
    value="Resolved"
    isSelected={filters.incidentFilters.includes('Resolved')}
    description="The incident is not currently firing."
    hasCheckbox
  >
    Resolved
  </SelectOption>,
];

export const daysMenuItems = (filters) => [
  <SelectOption key="1-day-filter" value="1 day" isSelected={filters.days.includes('1d')} />,
  <SelectOption key="3-day-filter" value="3 days" isSelected={filters.days.includes('3d')} />,
  <SelectOption key="7-day-filter" value="7 days" isSelected={filters.days.includes('7d')} />,
  <SelectOption key="15-day-filter" value="15 days" isSelected={filters.days.includes('15d')} />,
];

export const dropdownItems = (t, dispatch, incidentsActiveFilters, setIncidentsAreLoading) => [
  <DropdownItemDeprecated
    key="1-day-filter"
    component="button"
    onClick={() =>
      changeDaysFilter('1 day', dispatch, incidentsActiveFilters, setIncidentsAreLoading)
    }
  >
    {t('1 day')}
  </DropdownItemDeprecated>,
  <DropdownItemDeprecated
    key="3-day-filter"
    component="button"
    onClick={() =>
      changeDaysFilter('3 days', dispatch, incidentsActiveFilters, setIncidentsAreLoading)
    }
  >
    {t('3 days')}
  </DropdownItemDeprecated>,
  <DropdownItemDeprecated
    key="7-day-filter"
    component="button"
    onClick={() =>
      changeDaysFilter('7 days', dispatch, incidentsActiveFilters, setIncidentsAreLoading)
    }
  >
    {t('7 days')}
  </DropdownItemDeprecated>,
  <DropdownItemDeprecated
    key="15-day-filter"
    component="button"
    onClick={() =>
      changeDaysFilter('15 days', dispatch, incidentsActiveFilters, setIncidentsAreLoading)
    }
  >
    {t('15 days')}
  </DropdownItemDeprecated>,
];
