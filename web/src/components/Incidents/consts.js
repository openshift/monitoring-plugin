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

export const statusMenuItems = [
  <SelectOption key="longStanding" value="Long standing" />,
  <SelectOption key="informative" value="Informative" />,
  <SelectOption key="inactive" value="Inactive" />,
];

export const daysMenuItems = [
  <SelectOption key="1-day-filter" value="1 day" />,
  <SelectOption key="3-day-filter" value="3 days" />,
  <SelectOption key="7-day-filter" value="7 days" />,
  <SelectOption key="15-day-filter" value="15 days" />,
];
