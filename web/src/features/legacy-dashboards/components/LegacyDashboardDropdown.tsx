import {
  Label,
  LabelGroup,
  Level,
  LevelItem,
  SelectOption,
  SelectOptionProps,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { LegacyDashboardMetadata } from '@/features/legacy-dashboards/types/types';
import { SingleTypeaheadDropdown } from '@/shared/console/utils/SingleTypeaheadDropdown';
import { LegacyDashboardPageTestIDs } from '@/shared/constants/data-test';

type TagColor = 'red' | 'purple' | 'blue' | 'green' | 'teal' | 'orange';
const tagColors: TagColor[] = ['red', 'purple', 'blue', 'green', 'teal', 'orange'];

const Tag = memo(({ color, text }: { color: TagColor; text: string }) => (
  <Label isCompact color={color}>
    {text}
  </Label>
));

Tag.displayName = 'Tag';

export const DashboardDropdown: FC<DashboardDropdownProps> = ({ items, onChange, selectedKey }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const allTags = _.flatMap(items, 'tags');
  const uniqueTags = _.uniq(allTags);

  const OptionComponent = ({ value, isSelected, ...rest }: SelectOptionProps) => {
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

  const selectItems = _.map(items, (item: LegacyDashboardMetadata) => ({
    value: item.name,
    children: item.title,
  }));

  useEffect(() => {
    if (items.filter((item) => item.name === selectedKey).length === 0) {
      onChange(items.at(0)?.name);
    }
  }, [items, selectedKey, onChange]);

  return (
    <Stack data-test={LegacyDashboardPageTestIDs.DashboardDropdown} className="pf-v6-u-mb-sm">
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
  items: LegacyDashboardMetadata[];
  onChange: (v: string) => void;
  selectedKey: string;
};
