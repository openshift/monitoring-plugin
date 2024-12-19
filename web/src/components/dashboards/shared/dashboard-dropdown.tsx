import * as _ from 'lodash-es';
import { Label, SelectOption } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { SingleTypeaheadDropdown } from '../../console/utils/single-typeahead-dropdown';

type TagColor = 'red' | 'purple' | 'blue' | 'green' | 'cyan' | 'orange';
const tagColors: TagColor[] = ['red', 'purple', 'blue', 'green', 'cyan', 'orange'];

const Tag: React.FC<{ color: TagColor; text: string }> = React.memo(({ color, text }) => (
  <Label className="monitoring-dashboards__dashboard_dropdown_tag" color={color}>
    {text}
  </Label>
));

export const DashboardDropdown: React.FC<DashboardDropdownProps> = React.memo(
  ({ items, onChange, selectedKey }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const allTags = _.flatMap(items, 'tags');
    const uniqueTags = _.uniq(allTags);

    const OptionComponent = ({ value, isSelected, ...rest }) => (
      <SelectOption value={value} isSelected={isSelected || false} {...rest}>
        <div className="monitoring-dashboards__dashboard_dropdown_item">
          <span>{items[value]?.title}</span>
          <div className="monitoring-dashboards__dashboard_dropdown_tags">
            {items[value]?.tags?.map((tag, i) => (
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

    const selectItems = _.map(items, (item, key) => ({
      value: key,
      children: item.title,
    }));

    return (
      <div
        className="form-group monitoring-dashboards__dropdown-wrap"
        data-test="dashboard-dropdown"
      >
        <label
          className="monitoring-dashboards__dropdown-title"
          htmlFor="monitoring-board-dropdown"
        >
          {t('Dashboard')}
        </label>
        <SingleTypeaheadDropdown
          items={selectItems}
          onChange={onChange}
          OptionComponent={OptionComponent}
          selectedKey={selectedKey}
          hideClearButton
          resizeToFit
        />
      </div>
    );
  },
);

type DashboardDropdownProps = {
  items: {
    [key: string]: {
      tags: string[];
      title: string;
    };
  };
  onChange: (v: string) => void;
  selectedKey: string;
};
