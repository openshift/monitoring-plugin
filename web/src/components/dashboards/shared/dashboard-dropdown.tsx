import * as _ from 'lodash-es';
import {
  Label,
  LabelGroup,
  Level,
  LevelItem,
  SelectOption,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { SingleTypeaheadDropdown } from '../../console/utils/single-typeahead-dropdown';
import { CombinedDashboardMetadata } from '../perses/hooks/useDashboardsData';

type TagColor = 'red' | 'purple' | 'blue' | 'green' | 'teal' | 'orange';
const tagColors: TagColor[] = ['red', 'purple', 'blue', 'green', 'teal', 'orange'];

const Tag: React.FC<{ color: TagColor; text: string }> = React.memo(({ color, text }) => (
  <Label isCompact color={color}>
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
        <Level hasGutter>
          <LevelItem>
            <span>{matchedValue?.title}</span>
          </LevelItem>
          <LevelItem>
            <LabelGroup>
              {matchedValue?.tags?.map((tag, i) => (
                <Tag
                  key={i}
                  color={tagColors[_.indexOf(uniqueTags, tag) % tagColors.length]}
                  text={tag}
                />
              ))}
            </LabelGroup>
          </LevelItem>
        </Level>
      </SelectOption>
    );
  };

  const selectItems = _.map(items, (item: CombinedDashboardMetadata) => ({
    value: item.name,
    children: item.title,
  }));

  return (
    <Stack data-test="dashboard-dropdown">
      <StackItem>
        <label htmlFor="monitoring-board-dropdown">{t('Dashboard')}</label>
      </StackItem>
      <StackItem isFilled>
        <SingleTypeaheadDropdown
          items={selectItems}
          onChange={onChange}
          OptionComponent={OptionComponent}
          selectedKey={selectedKey}
          hideClearButton
          resizeToFit
        />
      </StackItem>
    </Stack>
  );
};

type DashboardDropdownProps = {
  items: CombinedDashboardMetadata[];
  onChange: (v: string) => void;
  selectedKey: string;
};
