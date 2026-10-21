import {
  Dropdown,
  DropdownItem,
  DropdownList,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import { FC, Ref, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TimeRangeSelectModal } from '@/features/logging/components/TimeRangeSelectModal';
import { useLocalStorage } from '@/features/logging/hooks/useLocalStorage';
import { TimeRange } from '@/features/logging/utils/logs-types';
import { TestIds } from '@/features/logging/utils/test-ids';
import {
  CUSTOM_TIME_RANGE_KEY,
  formatTimeRange,
  timeOptionKeyFromRange,
  timeRangeFromDuration,
  timeRangeOptions,
} from '@/features/logging/utils/time-range';

const DEFAULT_DURATION_KEY = '1h';
const STORED_TIME_RANGE_KEY = 'logging-view-plugin.time-range';

interface TimeRangeDropdownProps {
  value?: TimeRange;
  onChange?: (timeRange: TimeRange) => void;
  isDisabled?: boolean;
  timezone?: string;
}

const getSelectedOptionIndex = ({
  storedTimeRange,
  timeRangeValue,
}: {
  storedTimeRange?: TimeRange | null;
  timeRangeValue?: TimeRange;
}): number => {
  let durationKey: string | undefined;

  if (timeRangeValue) {
    durationKey = timeOptionKeyFromRange(timeRangeValue);
  }

  if (storedTimeRange) {
    durationKey = timeOptionKeyFromRange(storedTimeRange);
  }

  if (!durationKey) {
    durationKey = DEFAULT_DURATION_KEY;
  }

  return timeRangeOptions.findIndex((option) => option.key === durationKey) ?? 1;
};

export const TimeRangeDropdown: FC<TimeRangeDropdownProps> = ({
  onChange,
  value,
  isDisabled = false,
  timezone,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [isTimeRangeModalOpen, setIsTimeRangeModalOpen] = useState(false);
  const [storedTimeRange, setStoredTimeRange] = useLocalStorage<TimeRange>(STORED_TIME_RANGE_KEY);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(
    getSelectedOptionIndex({ storedTimeRange, timeRangeValue: value }),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Imported control sync.
    setSelectedIndex(getSelectedOptionIndex({ timeRangeValue: value }));
  }, [value]);

  const handleSelectedValue = (index: number) => () => {
    setIsOpen(false);

    const { key } = timeRangeOptions[index];

    if (key === CUSTOM_TIME_RANGE_KEY) {
      setIsTimeRangeModalOpen(true);
    } else {
      setSelectedIndex(index);
      const timeRange = timeRangeFromDuration(timeRangeOptions[index].key);
      onChange?.(timeRange);
      setStoredTimeRange(timeRange);
    }
  };

  const handleCustomRangeSelected = (customRange: TimeRange) => {
    setSelectedIndex(0);
    setIsTimeRangeModalOpen(false);
    onChange?.(customRange);
    setStoredTimeRange(customRange);
  };

  const toggleIsOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleCloseModal = () => {
    setIsTimeRangeModalOpen(false);
  };

  const timeRangeValue = value ?? storedTimeRange ?? undefined;

  return (
    <>
      {isTimeRangeModalOpen && (
        <TimeRangeSelectModal
          onClose={handleCloseModal}
          onSelectRange={handleCustomRangeSelected}
          initialRange={timeRangeValue}
          timezone={timezone}
        />
      )}
      <FormGroup fieldId="logs-time-range" data-test={TestIds.TimeRangeDropdown}>
        <Dropdown
          isOpen={isOpen}
          onSelect={() => setIsOpen(false)}
          onOpenChange={(isOpenVal: boolean) => setIsOpen(isOpenVal)}
          toggle={(toggleRef: Ref<MenuToggleElement>) => (
            <MenuToggle
              isDisabled={isDisabled}
              ref={toggleRef}
              onClick={toggleIsOpen}
              isExpanded={isOpen}
            >
              {timeRangeOptions[selectedIndex].key === CUSTOM_TIME_RANGE_KEY && timeRangeValue
                ? formatTimeRange(timeRangeValue, timezone)
                : timeRangeOptions[selectedIndex].name}
            </MenuToggle>
          )}
        >
          <DropdownList>
            {timeRangeOptions.map(({ key, name }, index) => (
              <DropdownItem ouiaId={key} onClick={handleSelectedValue(index)} key={key}>
                {
                  /*
                    t('plugin__monitoring-plugin~Custom time range')
                    t('plugin__monitoring-plugin~Last 5 minutes')
                    t('plugin__monitoring-plugin~Last 15 minutes')
                    t('plugin__monitoring-plugin~Last 30 minutes')
                    t('plugin__monitoring-plugin~Last 1 hour')
                    t('plugin__monitoring-plugin~Last 2 hours')
                    t('plugin__monitoring-plugin~Last 6 hours')
                    t('plugin__monitoring-plugin~Last 12 hours')
                    t('plugin__monitoring-plugin~Last 1 day')
                    t('plugin__monitoring-plugin~Last 2 days')
                    t('plugin__monitoring-plugin~Last 1 week')
                    t('plugin__monitoring-plugin~Last 2 weeks')
                  */
                  t(name)
                }
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </FormGroup>
    </>
  );
};
