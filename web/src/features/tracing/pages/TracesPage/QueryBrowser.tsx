import { Divider, PageSection, Split, SplitItem, Stack, Title } from '@patternfly/react-core';
import { useDataQueries, useTimeRange } from '@perses-dev/plugin-system';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, StringParam, useQueryParam, withDefault } from 'use-query-params';

import { ClosableAlert } from '@/features/tracing/components/ClosableAlert';
import {
  PersesDashboardWrapper,
  PersesTempoDatasourceWrapper,
  PersesWrapper,
} from '@/features/tracing/components/PersesWrapper';
import { TimeRangeSelect } from '@/features/tracing/components/TimeRangeSelect';
import { useTempoInstance } from '@/features/tracing/hooks/useTempoInstance';
import { DEFAULT_LIMIT, LimitSelect } from '@/features/tracing/pages/TracesPage/LimitSelect';
import { ScatterPlot } from '@/features/tracing/pages/TracesPage/ScatterPlot';
import { FilterToolbar } from '@/features/tracing/pages/TracesPage/Toolbar/FilterToolbar';
import { TraceTable } from '@/features/tracing/pages/TracesPage/TraceTable';

export function QueryBrowser() {
  return (
    <PersesWrapper>
      <PersesDashboardWrapper>
        <QueryBrowserBody />
      </PersesDashboardWrapper>
    </PersesWrapper>
  );
}

export function QueryBrowserBody() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const [tempo, setTempo] = useTempoInstance();
  const [query, setQuery] = useQueryParam('q', withDefault(StringParam, '{}'));
  const [limit, setLimit] = useQueryParam('limit', withDefault(NumberParam, DEFAULT_LIMIT));
  const { refresh } = useTimeRange();
  const isInitialRender = useRef(true);

  // Refresh query if Tempo instance or tenant changes.
  // The Perses data source is selected via a mock DatasourceApiImpl implementation in
  // <PersesWrapper>, therefore Perses doesn't refresh automatically if the Tempo instance changes.
  useEffect(() => {
    // Only call refresh() if the Tempo instance changed, not on the initial render of this
    // component.
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    refresh();
  }, [tempo, refresh]);

  const runQuery = useCallback(
    (query: string) => {
      setQuery(query);
      refresh();
    },
    [setQuery, refresh],
  );

  return (
    <>
      <PageSection className="mui-pf-theme">
        <Split hasGutter>
          <SplitItem isFilled>
            <Title headingLevel="h1">{t('Traces')}</Title>
          </SplitItem>
          <TimeRangeSelect />
          <LimitSelect limit={limit} setLimit={setLimit} />
        </Split>
        <Divider className="pf-v6-u-mt-md" />
      </PageSection>
      <PageSection className="mui-pf-theme">
        <Stack hasGutter>
          <FilterToolbar tempo={tempo} setTempo={setTempo} query={query} runQuery={runQuery} />
          <PersesTempoDatasourceWrapper
            tempo={tempo}
            definitions={[
              {
                kind: 'TraceQuery',
                spec: { plugin: { kind: 'TempoTraceQuery', spec: { query, limit } } },
              },
            ]}
          >
            <TraceSearchResults setQuery={setQuery} />
          </PersesTempoDatasourceWrapper>
        </Stack>
      </PageSection>
    </>
  );
}

interface TraceSearchResultsProps {
  setQuery: (query: string) => void;
}

function TraceSearchResults({ setQuery }: TraceSearchResultsProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { queryResults } = useDataQueries('TraceQuery');
  const hasMoreResults = queryResults.some((traceData) => traceData.data?.metadata?.hasMoreResults);

  return (
    <>
      {hasMoreResults && (
        <ClosableAlert
          variant="warning"
          ouiaId="WarningAlert"
          isInline
          title={t(
            'Not all matching traces are currently visible. Increase the display limit to view more.',
          )}
        />
      )}
      <ScatterPlot />
      <TraceTable setQuery={setQuery} />
    </>
  );
}
