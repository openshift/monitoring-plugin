import React from 'react';
import {
  ToolbarItem,
  ToolbarFilter,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Badge,
} from '@patternfly/react-core';
import { getFilterKey } from './utils';
import { IncidentFiltersCombined } from './model';
import { setAlertsAreLoading } from '../../store/actions';
import { DataTestIDs } from '../data-test';

interface IncidentFilterToolbarItemProps {
  categoryName: string;
  toggleLabel: string;
  options: {
    value: string;
    description?: string;
  }[];
  incidentsActiveFilters: IncidentFiltersCombined;
  onDeleteIncidentFilterChip: (
    category: string,
    chip: string,
    activeFilters: any,
    dispatch: any,
  ) => void;
  onDeleteGroupIncidentFilterChip: (activeFilters: any, dispatch: any, category: any) => void;
  incidentFilterIsExpanded: boolean;
  onIncidentFiltersSelect: (
    event: React.MouseEvent | React.ChangeEvent | undefined,
    selection: any,
    dispatch: any,
    activeFilters: any,
    categoryFilterType: string,
  ) => void;
  setIncidentIsExpanded: (isOpen: boolean) => void;
  onIncidentFilterToggle: React.MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
  dispatch: any;
  showToolbarItem?: boolean;
}

const IncidentFilterToolbarItem: React.FC<IncidentFilterToolbarItemProps> = ({
  categoryName,
  toggleLabel,
  options,
  incidentsActiveFilters,
  onDeleteIncidentFilterChip,
  onDeleteGroupIncidentFilterChip,
  incidentFilterIsExpanded,
  onIncidentFiltersSelect,
  setIncidentIsExpanded,
  onIncidentFilterToggle,
  dispatch,
  showToolbarItem,
}) => {
  return (
    <ToolbarItem>
      <ToolbarFilter
        showToolbarItem={showToolbarItem}
        labels={incidentsActiveFilters[getFilterKey(categoryName)]}
        deleteLabel={(category, chip) => {
          if (typeof category === 'string' && typeof chip === 'string') {
            onDeleteIncidentFilterChip(category, chip, incidentsActiveFilters, dispatch);
            if (categoryName === 'Incident ID') {
              dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
            }
          }
        }}
        deleteLabelGroup={(category) => {
          onDeleteGroupIncidentFilterChip(incidentsActiveFilters, dispatch, category);
          if (categoryName === 'Incident ID') {
            dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
          }
        }}
        categoryName={categoryName}
        data-test={`${DataTestIDs.IncidentsPage.FilterChip}-${categoryName.toLowerCase()}`}
      >
        <Select
          id={`${categoryName}-select`.toLowerCase()}
          role="menu"
          aria-label="Filters"
          data-test={`${DataTestIDs.IncidentsPage.FiltersSelect}-${categoryName.toLowerCase()}`}
          isOpen={incidentFilterIsExpanded}
          selected={incidentsActiveFilters[getFilterKey(categoryName)]}
          onSelect={(event, selection) => {
            if (typeof selection === 'string') {
              onIncidentFiltersSelect(
                event,
                selection,
                dispatch,
                incidentsActiveFilters,
                categoryName.toLowerCase(),
              );
            }
          }}
          onOpenChange={(isOpen) => setIncidentIsExpanded(isOpen)}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              onClick={onIncidentFilterToggle}
              isExpanded={incidentFilterIsExpanded}
              data-test={`${
                DataTestIDs.IncidentsPage.FiltersSelectToggle
              }-${categoryName.toLowerCase()}`}
              badge={
                Object.entries(incidentsActiveFilters?.[getFilterKey(categoryName)] || {}).length >
                0 ? (
                  <Badge isRead>
                    {Object.entries(incidentsActiveFilters[getFilterKey(categoryName)]).length}
                  </Badge>
                ) : undefined
              }
            >
              {toggleLabel}
            </MenuToggle>
          )}
          shouldFocusToggleOnSelect
        >
          <SelectList
            data-test={`${
              DataTestIDs.IncidentsPage.FiltersSelectList
            }-${categoryName.toLowerCase()}`}
          >
            {options.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                isSelected={(incidentsActiveFilters[getFilterKey(categoryName)] ?? []).includes(
                  option.value,
                )}
                description={option?.description}
                hasCheckbox={categoryName === 'Incident ID' ? false : true}
                data-test={`${
                  DataTestIDs.IncidentsPage.FiltersSelectOption
                }-${categoryName.toLowerCase()}-${option.value.toLowerCase()}`}
              >
                {option.value}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      </ToolbarFilter>
    </ToolbarItem>
  );
};

export default IncidentFilterToolbarItem;

export const severityOptions = [
  { value: 'Critical', description: 'The incident is critical.' },
  { value: 'Warning', description: 'The incident might lead to critical.' },
  { value: 'Informative', description: 'The incident is not critical.' },
];

export const stateOptions = [
  { value: 'Firing', description: 'The incident is currently firing.' },
  { value: 'Resolved', description: 'The incident is not currently firing.' },
];
