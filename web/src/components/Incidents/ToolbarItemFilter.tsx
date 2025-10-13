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
import { useTranslation } from 'react-i18next';

interface IncidentFilterToolbarItemProps {
  categoryName: string;
  toggleLabel: string;
  options: {
    value: string;
    label?: string;
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
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const translateLabels = (values: string[]) => {
    if (!values) return values;
    const labelMap = options.reduce((acc, opt) => {
      acc[opt.value] = opt.label || opt.value;
      return acc;
    }, {} as Record<string, string>);
    return values.map((val) => labelMap[val] || val);
  };

  const reverseTranslateLabel = (label: string): string => {
    const option = options.find((opt) => (opt.label || opt.value) === label);
    return option ? option.value : label;
  };

  return (
    <ToolbarItem>
      <ToolbarFilter
        showToolbarItem={showToolbarItem}
        labels={translateLabels(incidentsActiveFilters[getFilterKey(categoryName)])}
        deleteLabel={(category, chip) => {
          if (typeof category === 'string' && typeof chip === 'string') {
            const originalValue = reverseTranslateLabel(chip);
            onDeleteIncidentFilterChip(
              categoryName,
              originalValue,
              incidentsActiveFilters,
              dispatch,
            );
            if (categoryName === 'Incident ID') {
              dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
            }
          }
        }}
        deleteLabelGroup={() => {
          onDeleteGroupIncidentFilterChip(incidentsActiveFilters, dispatch, categoryName);
          if (categoryName === 'Incident ID') {
            dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
          }
        }}
        categoryName={t(categoryName)}
        data-test={`${DataTestIDs.IncidentsPage.FilterChip}-${categoryName.toLowerCase()}`}
      >
        <Select
          id={`${categoryName}-select`.toLowerCase()}
          role="menu"
          aria-label={toggleLabel}
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
            if (categoryName === 'Incident ID') {
              setIncidentIsExpanded(false);
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
                {option.label || option.value}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      </ToolbarFilter>
    </ToolbarItem>
  );
};

export default IncidentFilterToolbarItem;

export const useSeverityOptions = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return [
    { value: 'Critical', label: t('Critical'), description: t('The incident is critical.') },
    {
      value: 'Warning',
      label: t('Warning'),
      description: t('The incident might lead to critical.'),
    },
    {
      value: 'Informative',
      label: t('Informative'),
      description: t('The incident is not critical.'),
    },
  ];
};

export const useStateOptions = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return [
    { value: 'Firing', label: t('Firing'), description: t('The incident is currently firing.') },
    {
      value: 'Resolved',
      label: t('Resolved'),
      description: t('The incident is not currently firing.'),
    },
  ];
};
