import { useState } from 'react';
import * as _ from 'lodash';
import AutocompleteInput from '../console/public/components/autocomplete';
import { ToolbarFilter, ToolbarLabel } from '@patternfly/react-core';

export type DataViewLabelFilterProps<TData> = {
  data: TData[];
  title: string;
  filterId: string;
  placeholder: string;
  onChange?: (key: string, selectedValues: string) => void;
  showToolbarItem?: boolean;
  labelPath?: string;
  value?: string;
};

export const TableLabelFilter = <TData,>({
  data,
  title,
  filterId,
  onChange,
  showToolbarItem,
  labelPath,
  value,
  placeholder,
}: DataViewLabelFilterProps<TData>) => {
  const [labelInputText, setLabelInputText] = useState('');
  const labelSelection =
    value
      ?.split(',')
      .filter(Boolean)
      .map((filter) => {
        return { key: filter, node: filter };
      }) ?? [];
  const applyLabelFilters = (values: string[]) => {
    setLabelInputText('');
    onChange?.(filterId, values.join(','));
  };

  return (
    <ToolbarFilter
      categoryName={title}
      labels={labelSelection}
      showToolbarItem={showToolbarItem}
      deleteLabel={(_category, label: ToolbarLabel) => {
        setLabelInputText('');
        applyLabelFilters(_.difference(labelSelection, [label]).map((labels) => labels.key));
      }}
    >
      <div className="pf-v6-c-input-group">
        <AutocompleteInput
          color="purple"
          onSuggestionSelect={(selected) => {
            applyLabelFilters(_.uniq([...labelSelection.map((label) => label.key), selected]));
          }}
          showSuggestions
          textValue={labelInputText}
          setTextValue={setLabelInputText}
          placeholder={placeholder}
          data={data}
          labelPath={labelPath}
        />
      </div>
    </ToolbarFilter>
  );
};
