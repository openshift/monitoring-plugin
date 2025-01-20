import * as _ from 'lodash-es';
import { Label, SelectOption } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { SingleTypeaheadDropdown } from '../../console/utils/single-typeahead-dropdown';
import { CombinedDashboardMetadata } from './useDashboardsData';

type TagColor = 'red' | 'purple' | 'blue' | 'green' | 'cyan' | 'orange';
const tagColors: TagColor[] = ['red', 'purple', 'blue', 'green', 'cyan', 'orange'];

const Tag: React.FC<{ color: TagColor; text: string }> = React.memo(({ color, text }) => (
  <Label className="monitoring-dashboards__dashboard_dropdown_tag" color={color}>
    {text}
  </Label>
));

export const DashboardDropdown: React.FC<DashboardDropdownProps> = ({
  items,
  onChange,
  selectedKey,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const allTags = _.flatMap(items, 'tags');
  const uniqueTags = _.uniq(allTags);

  const OptionComponent = ({ value, isSelected, ...rest }) => {
    const matchedValue = items.find((item) => {
      return item.name === value;
    });
    return (
      <SelectOption value={value} isSelected={isSelected || false} {...rest}>
        <div className="monitoring-dashboards__dashboard_dropdown_item">
          <span>{matchedValue?.title}</span>
          <div className="monitoring-dashboards__dashboard_dropdown_tags">
            {matchedValue?.tags?.map((tag, i) => (
              <Tag
                color={tagColors[_.indexOf(uniqueTags, tag) % tagColors.length]}
                key={i}
                text={tag}
              />
            ))}
          </div>
        </div>
      </SelectOption>
    );
  };

  const selectItems = _.map(items, (item: CombinedDashboardMetadata) => ({
    value: item.name,
    children: item.title,
  }));

  return (
    <div className="form-group monitoring-dashboards__dropdown-wrap" data-test="dashboard-dropdown">
      <label className="monitoring-dashboards__dropdown-title" htmlFor="monitoring-board-dropdown">
        {t('Dashboard')}
      </label>
      <SingleTypeaheadDropdown
        items={selectItems}
        onChange={onChange}
        OptionComponent={OptionComponent}
        selectedKey={selectedKey}
        hideClearButton
        resizeToFit
        clearOnNewItems
      />
    </div>
  );
};

type DashboardDropdownProps = {
  items: CombinedDashboardMetadata[];
  onChange: (v: string) => void;
  selectedKey: string;
};
