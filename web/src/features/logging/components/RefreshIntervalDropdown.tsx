import {
  Dropdown,
  DropdownItem,
  DropdownList,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import { FC, Ref, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocalStorage } from '@/features/logging/hooks/useLocalStorage';
import { TestIds } from '@/features/logging/utils/test-ids';

const STORED_REFRESH_INTERVAL_KEY = 'logging-view-plugin.refresh-interval';

const refreshIntervalOptions = [
  { key: 'OFF_KEY', name: 'Refresh off', delay: 0 },
  { key: '15s', name: '15 seconds', delay: 15 * 1000 },
  { key: '30s', name: '30 seconds', delay: 30 * 1000 },
  { key: '1m', name: '1 minute', delay: 60 * 1000 },
  { key: '5m', name: '5 minutes', delay: 5 * 60 * 1000 },
  { key: '15m', name: '15 minutes', delay: 15 * 60 * 1000 },
  { key: '30m', name: '30 minutes', delay: 30 * 60 * 1000 },
  { key: '1h', name: '1 hour', delay: 60 * 60 * 1000 },
  { key: '2h', name: '2 hours', delay: 2 * 60 * 60 * 1000 },
  { key: '1d', name: '1 day', delay: 24 * 60 * 60 * 1000 },
];

interface RefreshIntervalDropdownProps {
  onRefresh?: () => void;
  isDisabled?: boolean;
}

export const RefreshIntervalDropdown: FC<RefreshIntervalDropdownProps> = ({
  onRefresh,
  isDisabled = false,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [storedRefreshInterval, setStoredRefreshInterval] = useLocalStorage<{ interval: string }>(
    STORED_REFRESH_INTERVAL_KEY,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(
    storedRefreshInterval && !isNaN(parseInt(storedRefreshInterval.interval, 10))
      ? parseInt(storedRefreshInterval.interval, 10)
      : 0,
  );
  const [delay, setDelay] = useState<number>(refreshIntervalOptions[selectedIndex].delay);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  // eslint-disable-next-line react-hooks/refs
  onRefreshRef.current = onRefresh;

  const clearTimer = () => {
    if (timer.current) {
      clearInterval(timer.current);
    }
  };

  const handleSelectedValue = (index: number) => () => {
    setIsOpen(false);
    setSelectedIndex(index);
    const selectedDelay = refreshIntervalOptions[index].delay;
    setDelay(selectedDelay);
    setStoredRefreshInterval({ interval: index.toString(10) });
  };

  useEffect(() => {
    clearTimer();

    if (delay !== 0) {
      onRefreshRef.current?.();
      timer.current = setInterval(() => onRefreshRef.current?.(), delay);
    }

    return () => clearTimer();
  }, [delay]);

  const toggleIsOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <FormGroup fieldId="logs-refresh-interval" data-test={TestIds.RefreshIntervalDropdown}>
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
            {refreshIntervalOptions[selectedIndex].name}
          </MenuToggle>
        )}
      >
        <DropdownList>
          {refreshIntervalOptions.map(({ key, name }, index) => (
            <DropdownItem ouiaId={key} onClick={handleSelectedValue(index)} key={key}>
              {
                /*
                  t('plugin__monitoring-plugin~Refresh off')
                  t('plugin__monitoring-plugin~15 seconds')
                  t('plugin__monitoring-plugin~30 seconds')
                  t('plugin__monitoring-plugin~1 minute')
                  t('plugin__monitoring-plugin~5 minutes')
                  t('plugin__monitoring-plugin~15 minutes')
                  t('plugin__monitoring-plugin~30 minutes')
                  t('plugin__monitoring-plugin~1 hour')
                  t('plugin__monitoring-plugin~2 hours')
                  t('plugin__monitoring-plugin~1 day')
                */
                t(name)
              }
            </DropdownItem>
          ))}
        </DropdownList>
      </Dropdown>
    </FormGroup>
  );
};
