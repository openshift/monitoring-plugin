import { Button, Flex, FlexItem } from '@patternfly/react-core';
import { ChartLineIcon, CompressIcon } from '@patternfly/react-icons';
import type { FC } from 'react';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { DataTestIDs } from '@/shared/constants/data-test';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { getObserveState } from '@/shared/hooks/usePerspective';
import { showGraphs, toggleGraphs } from '@/shared/store/actions';
import { MonitoringState } from '@/shared/store/store';

export const ToggleGraph: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getObserveState(plugin, state).hideGraphs,
  );

  const dispatch = useDispatch();
  const toggle = useCallback(() => dispatch(toggleGraphs()), [dispatch]);

  // Use an empty useEffect to get access to the cleanup function so that if graphs are
  // currently hidden then we show the graphs as we unmount
  useEffect(() => {
    return () => {
      dispatch(showGraphs());
    };
  }, [dispatch]);

  const icon = hideGraphs ? <ChartLineIcon /> : <CompressIcon />;

  return (
    <Flex justifyContent={{ default: 'justifyContentFlexEnd' }}>
      <FlexItem>
        <Button
          type="button"
          onClick={toggle}
          variant="link"
          data-test={DataTestIDs.MetricHideShowGraphButton}
        >
          {icon} {hideGraphs ? t('Show graph') : t('Hide graph')}
        </Button>
      </FlexItem>
    </Flex>
  );
};
