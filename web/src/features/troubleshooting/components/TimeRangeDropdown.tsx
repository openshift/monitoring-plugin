import {
  Alert,
  Button,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  MenuToggle,
  MenuToggleElement,
  NumberInput,
  Popover,
} from '@patternfly/react-core';
import { FC, MutableRefObject, Ref, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimeUnitLabel } from '../hooks/useTimeUnitLabel';
import * as time from '../time';
import { DateTimePicker } from './DateTimePicker';
import { TimeUnitPicker } from './TimeUnitPicker';

const CUSTOM_RANGE_KEY = 'CUSTOM_RANGE';
const CUSTOM_DURATION_KEY = 'CUSTOM_DURATION';
const PAGE_TIME_RANGE_KEY = 'PAGE_TIME_RANGE';

const timeRangeOptions = [
  { key: '5m', period: new time.Duration(5, time.MINUTE) },
  { key: '30m', period: new time.Duration(30, time.MINUTE) },
  { key: '1h', period: new time.Duration(1, time.HOUR) },
  { key: '1d', period: new time.Duration(1, time.DAY) },
  { key: '1w', period: new time.Duration(1, time.WEEK) },
];

const keyFromPeriod = (period: time.Period): string => {
  if (period instanceof time.Duration) {
    const match = timeRangeOptions.find(
      (o) => o.period.count === period.count && o.period.unit === period.unit,
    );
    if (match) return match.key;
    return CUSTOM_DURATION_KEY;
  }
  return CUSTOM_RANGE_KEY;
};

interface TimeRangeModalProps {
  initialRange: time.Range;
  onSave: (range: time.Range) => void;
  onClose: () => void;
}

const TimeRangeForm: FC<TimeRangeModalProps> = ({ initialRange, onSave, onClose }) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);
  const isValid = start < end;

  return (
    <Flex direction={{ default: 'column' }}>
      <FlexItem>
        <label>{t('From')}</label>
        <DateTimePicker date={start} onChange={setStart} />
      </FlexItem>
      <FlexItem>
        <label>{t('To')}</label>
        <DateTimePicker date={end} onChange={setEnd} />
      </FlexItem>
      {!isValid && (
        <Alert variant="danger" isInline isPlain title={t('End time must be after start time')} />
      )}
      <FlexItem>
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Button
              variant="primary"
              onClick={() => onSave(new time.Range(start, end))}
              isDisabled={!isValid}
            >
              {t('Save')}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="link" onClick={onClose}>
              {t('Cancel')}
            </Button>
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  );
};

interface DurationModalProps {
  initialDuration: time.Duration;
  onSave: (duration: time.Duration) => void;
  onClose: () => void;
}

const DurationForm: FC<DurationModalProps> = ({ initialDuration, onSave, onClose }) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const [count, setCount] = useState(initialDuration.count);
  const [unit, setUnit] = useState(initialDuration.unit);

  const onChangeCount = (n: number) => setCount(Math.max(1, n || 1));

  return (
    <Flex direction={{ default: 'column' }}>
      <FlexItem>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>{t('Last')}</FlexItem>
          <FlexItem>
            <NumberInput
              value={count}
              min={1}
              onPlus={() => onChangeCount(count + 1)}
              onMinus={() => onChangeCount(count - 1)}
              onChange={(e) => onChangeCount(Number((e.target as HTMLInputElement).value))}
              widthChars={3}
            />
          </FlexItem>
          <FlexItem>
            <TimeUnitPicker unit={unit} onChange={setUnit} />
          </FlexItem>
        </Flex>
      </FlexItem>
      <FlexItem>
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Button
              variant="primary"
              onClick={() => onSave(new time.Duration(count, unit))}
              isDisabled={count < 1}
            >
              {t('Save')}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="link" onClick={onClose}>
              {t('Cancel')}
            </Button>
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  );
};

interface TimeRangeDropdownProps {
  period: time.Period;
  onChange: (period: time.Period) => void;
  className?: string;
  locationPeriod?: time.Period;
}

export const TimeRangeDropdown: FC<TimeRangeDropdownProps> = ({
  period,
  onChange,
  className,
  locationPeriod,
}) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const [isOpen, setIsOpen] = useState(false);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [durationModalOpen, setDurationModalOpen] = useState(false);
  const toggleElementRef = useRef<MenuToggleElement>(null);

  const selectedKey = keyFromPeriod(period);

  const handleCustomRangeClick = () => {
    setIsOpen(false);
    setRangeModalOpen(true);
  };

  const handleCustomDurationClick = () => {
    setIsOpen(false);
    setDurationModalOpen(true);
  };

  const initialRange = useMemo(() => {
    const [start, end] = period.startEnd();
    return new time.Range(start, end);
  }, [period]);

  const initialDuration = useMemo(
    () => (period instanceof time.Duration ? period : new time.Duration(1, time.DAY)),
    [period],
  );

  const timeUnitLabel = useTimeUnitLabel();
  const labelFromPeriod = useCallback(
    (period: time.Period): string => {
      if (period instanceof time.Duration) {
        return `${t('Last')} ${period.count} ${timeUnitLabel(period.unit)}`;
      }
      if (period instanceof time.Range) {
        return `${time.formatDate(period.start)} – ${time.formatDate(period.end)}`;
      }
      return t('Custom');
    },
    [timeUnitLabel, t],
  );

  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onSelect={() => setIsOpen(false)}
        onOpenChange={setIsOpen}
        toggle={(toggleRef: Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={(element) => {
              toggleElementRef.current = element;
              if (typeof toggleRef === 'function') toggleRef(element);
              else if (toggleRef)
                (toggleRef as MutableRefObject<MenuToggleElement | null>).current = element;
            }}
            onClick={() => setIsOpen(!isOpen)}
            isExpanded={isOpen}
            className={className}
          >
            {labelFromPeriod(period)}
          </MenuToggle>
        )}
      >
        <DropdownList>
          {timeRangeOptions.map(({ key, period: optPeriod }) => (
            <DropdownItem
              key={key}
              isSelected={key === selectedKey}
              onClick={() => onChange(optPeriod)}
            >
              {labelFromPeriod(optPeriod)}
            </DropdownItem>
          ))}
          <Divider />
          <DropdownItem
            key={CUSTOM_DURATION_KEY}
            isSelected={selectedKey === CUSTOM_DURATION_KEY}
            onClick={handleCustomDurationClick}
          >
            {t('Custom duration')}
          </DropdownItem>
          <DropdownItem
            key={CUSTOM_RANGE_KEY}
            isSelected={selectedKey === CUSTOM_RANGE_KEY}
            onClick={handleCustomRangeClick}
          >
            {t('Custom time range')}
          </DropdownItem>
          {locationPeriod && (
            <DropdownItem
              key={PAGE_TIME_RANGE_KEY}
              isSelected={selectedKey === PAGE_TIME_RANGE_KEY}
              onClick={() => onChange(locationPeriod)}
            >
              {t('Time from main view')}
            </DropdownItem>
          )}
        </DropdownList>
      </Dropdown>
      <Popover
        headerContent={t('Custom time range')}
        bodyContent={
          <TimeRangeForm
            initialRange={initialRange}
            onSave={(range) => {
              setRangeModalOpen(false);
              onChange(range);
            }}
            onClose={() => setRangeModalOpen(false)}
          />
        }
        triggerRef={toggleElementRef}
        isVisible={rangeModalOpen}
        showClose={false}
        position="bottom-end"
        maxWidth="32rem"
      />
      <Popover
        headerContent={t('Custom duration')}
        bodyContent={
          <DurationForm
            initialDuration={initialDuration}
            onSave={(duration) => {
              setDurationModalOpen(false);
              onChange(duration);
            }}
            onClose={() => setDurationModalOpen(false)}
          />
        }
        triggerRef={toggleElementRef}
        isVisible={durationModalOpen}
        showClose={false}
        position="bottom-end"
        maxWidth="24rem"
      />
    </>
  );
};
