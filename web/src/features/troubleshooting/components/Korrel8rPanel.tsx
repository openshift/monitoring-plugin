import {
  Button,
  Divider,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  ExpandableSection,
  ExpandableSectionToggle,
  Spinner,
  Stack,
  StackItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';

import { CubesIcon, ExclamationCircleIcon, SlidersHIcon, RedoIcon } from '@patternfly/react-icons';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useFeature } from '../hooks/useFeatures';
import { useLocationQuery } from '../hooks/useLocationQuery';
import { usePluginAvailable } from '../hooks/usePluginAvailable';
import { GraphResult, useKorrel8rGraph } from '../korrel8r-client';
import * as korrel8r from '../korrel8r/types';
import { defaultSearch, Search, setSearch } from '../redux-actions';
import { State } from '../redux-reducers';
import * as time from '../time';
import { AdvancedSearchForm } from './AdvancedSearchForm';
import AgentMenu from './AgentMenu';
import './korrel8rpanel.css';
import { TimeRangeDropdown } from './TimeRangeDropdown';
import { Korrel8rTopology } from './topology/Korrel8rTopology';

export default function Korrel8rPanel() {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const dispatch = useDispatch();
  const { query: locationQuery, period: locationPeriod } = useLocationQuery();
  const featureEnabled = useFeature('agent-navigation');

  const search: Search = useSelector((state: State) => state.plugins?.tp?.get('search'));

  const { data, isError, error, isFetching, isPending, fetchStatus, refetch } = useKorrel8rGraph({
    search,
  });
  const isCancelled = !!search?.queryStr && isPending && fetchStatus === 'idle';
  const queryClient = useQueryClient();

  const startNodeId = useMemo(() => {
    try {
      return search?.queryStr ? korrel8r.Query.parse(search?.queryStr).class.toString() : undefined;
    } catch {
      return undefined;
    }
  }, [search?.queryStr]);

  // Compute the state {disabled, tooltip} of the correlate button
  const correlateState = useMemo((): { disabled: boolean; tooltip: string } => {
    if (!locationQuery?.toString())
      return { disabled: true, tooltip: t("Can't correlate from this view") };
    if (locationQuery.toString() === search?.queryStr && !isError && !isCancelled)
      return {
        disabled: true,
        tooltip: isFetching ? t('Correlation in progress') : t('Already correlated with this view'),
      };
    return { disabled: false, tooltip: t('Correlate from this view') };
  }, [locationQuery, search?.queryStr, isCancelled, isError, isFetching, t]);

  // Showing advanced query
  const [showAdvanced, setShowAdvanced] = useState(false);

  const dispatchSearch = useCallback(
    (search: Search) => dispatch(setSearch({ ...search })),
    [dispatch],
  );

  // Auto-correlate if queryStr is empty, which is always true on first open.
  useEffect(() => {
    if (!search?.queryStr && locationQuery?.toString())
      dispatchSearch({ ...defaultSearch, queryStr: locationQuery.toString() });
  }, [search?.queryStr, locationQuery, dispatchSearch]);

  const advancedToggleID = 'query-toggle';
  const advancedContentID = 'query-content';

  return (
    <>
      <Stack>
        <Toolbar className="tp-plugin__panel-toolbar">
          <ToolbarContent>
            <ToolbarItem>
              <Tooltip content={correlateState.tooltip} position="bottom">
                <Button
                  variant="primary"
                  isAriaDisabled={correlateState.disabled}
                  onClick={() => {
                    if (
                      locationQuery?.toString() === search?.queryStr &&
                      (isError || isCancelled)
                    ) {
                      refetch();
                    } else {
                      dispatchSearch({ ...search, queryStr: locationQuery?.toString() });
                    }
                  }}
                >
                  {t('Correlate')}
                </Button>
              </Tooltip>
            </ToolbarItem>

            <ToolbarItem>
              <Tooltip content={t('Advanced search')} position="bottom">
                <ExpandableSectionToggle
                  contentId={advancedContentID}
                  toggleId={advancedToggleID}
                  isExpanded={showAdvanced}
                  onToggle={(on: boolean) => setShowAdvanced(on)}
                  aria-label={t('Advanced search')}
                >
                  <SlidersHIcon />
                </ExpandableSectionToggle>
              </Tooltip>
            </ToolbarItem>

            <ToolbarGroup align={{ default: 'alignCenter' }}>
              <ToolbarItem>
                <Tooltip content={t('Limit search to this time range')} position="bottom">
                  <TimeRangeDropdown
                    period={search.period ?? defaultSearch.period}
                    onChange={(period: time.Period) => dispatchSearch({ ...search, period })}
                    locationPeriod={locationPeriod}
                  />
                </Tooltip>
              </ToolbarItem>
            </ToolbarGroup>

            <ToolbarGroup align={{ default: 'alignEnd' }}>
              {featureEnabled && (
                <ToolbarItem>
                  <Tooltip content={t('AI agent navigation')} position="bottom-end">
                    <AgentMenu />
                  </Tooltip>
                </ToolbarItem>
              )}
              <ToolbarItem>
                {isFetching ? (
                  <Button
                    variant="secondary"
                    onClick={() => queryClient.cancelQueries({ queryKey: ['korrel8r', 'graph'] })}
                  >
                    {t('Cancel')}
                  </Button>
                ) : (
                  <Tooltip content={t('Refresh')} position="bottom-end">
                    <Button
                      variant="plain"
                      isAriaDisabled={!search?.queryStr}
                      onClick={() => refetch()}
                      aria-label={t('Refresh')}
                    >
                      <RedoIcon />
                    </Button>
                  </Tooltip>
                )}
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
        <ExpandableSection
          className="tp-plugin__panel-query-container"
          contentId={advancedContentID}
          toggleId={advancedToggleID}
          isExpanded={showAdvanced}
          isDetached
        >
          <AdvancedSearchForm
            search={search}
            onSearch={dispatchSearch}
            onClose={() => setShowAdvanced(false)}
          />
        </ExpandableSection>

        <Divider />

        <StackItem className="tp-plugin__panel-topology-container" isFilled={true}>
          <Topology
            isLoading={isFetching}
            result={data}
            startNode={startNodeId}
            constraint={data?.constraint}
            error={error}
            isCancelled={isCancelled}
          />
        </StackItem>
      </Stack>
    </>
  );
}

interface TopologyProps {
  isLoading?: boolean;
  isCancelled?: boolean;
  result?: GraphResult;
  startNode?: string;
  error?: Error;
  constraint?: korrel8r.Constraint;
}

const Topology: FC<TopologyProps> = ({
  isLoading,
  result,
  startNode,
  constraint,
  error,
  isCancelled,
}) => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  const [loggingAvailable, loggingAvailableLoading] = usePluginAvailable('logging-view-plugin');
  const [netobserveAvailable, netobserveAvailableLoading] = usePluginAvailable('netobserv-plugin');

  if (isLoading || loggingAvailableLoading || netobserveAvailableLoading) {
    // korrel8r query is loading or the plugin checks are loading
    return <Searching />;
  }

  if (isCancelled) {
    return (
      <TopologyInfoState titleText={t('Canceled')} text={t('Search was interrupted')} isError />
    );
  }

  if (result?.graph?.nodes) {
    // Non-empty graph
    return (
      <Korrel8rTopology
        graph={result.graph}
        startNode={startNode}
        loggingAvailable={loggingAvailable}
        netobserveAvailable={netobserveAvailable}
        constraint={constraint}
      />
    );
  }

  if (error) {
    const detail = String(error?.message || error?.name || t('Unknown error'));
    return (
      <TopologyInfoState
        titleText={t('Could not reach the correlation service')}
        text={detail.slice(0, 400)}
        isError
      />
    );
  }

  return (
    <TopologyInfoState
      titleText={result?.title || t('No correlated signals found')}
      text={result?.message?.slice(0, 400) || t('Try a different starting point')}
    />
  );
};

const Searching: FC = () => {
  const { t } = useTranslation('plugin__troubleshooting-panel-console-plugin');
  return (
    <div className="tp-plugin__panel-topology-info">
      <EmptyState
        variant={EmptyStateVariant.sm}
        titleText={t('Searching')}
        headingLevel="h4"
        icon={Spinner}
      />
    </div>
  );
};

interface TopologyInfoStateProps {
  titleText: string;
  text: string;
  isError?: boolean;
}

const TopologyInfoState: FC<TopologyInfoStateProps> = ({ titleText, text, isError }) => {
  return (
    <div className="tp-plugin__panel-topology-info">
      <EmptyState
        variant={EmptyStateVariant.sm}
        titleText={titleText}
        headingLevel="h4"
        icon={isError ? ExclamationCircleIcon : CubesIcon}
        status={isError ? 'danger' : undefined}
      >
        <EmptyStateBody>{text}</EmptyStateBody>
      </EmptyState>
    </div>
  );
};
