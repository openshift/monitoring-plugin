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
import FilterIcon from '@patternfly/react-icons/dist/js/icons/filter-icon';
import { getFilterKey } from './utils'; // Assuming this utility function exists

interface IncidentFilterToolbarItemProps {
  categoryName: string;
  toggleLabel: string;
  options: {
    value: string;
    description?: string;
  }[];
  incidentsActiveFilters: {
    severity: string[];
    state: string[];
    days: string[];
    groupId: string[];
  };
  onDeleteIncidentFilterChip: (
    category: string,
    chip: string,
    activeFilters: any,
    dispatch: any,
  ) => void;
  onDeleteGroupIncidentFilterChip: (activeFilters: any, dispatch: any, category: any) => void;
  incidentFilterIsExpanded: boolean;
  onIncidentFiltersSelect: (
    event: React.MouseEvent | React.ChangeEvent,
    selection: string | undefined,
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
          }
        }}
        deleteLabelGroup={(category) =>
          onDeleteGroupIncidentFilterChip(incidentsActiveFilters, dispatch, category)
        }
        categoryName={categoryName}
      >
        <Select
          id={`${categoryName}-select`.toLowerCase()}
          role="menu"
          aria-label="Filters"
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
              icon={<FilterIcon />}
              badge={
                Object.entries(incidentsActiveFilters[getFilterKey(categoryName)]).length > 0 ? (
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
          <SelectList>
            {options.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                isSelected={(incidentsActiveFilters[getFilterKey(categoryName)] ?? []).includes(
                  option.value,
                )}
                description={option?.description}
                hasCheckbox
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
