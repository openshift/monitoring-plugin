import { PersesPanelPluginWrapper } from '../../components/PersesWrapper';
import { TraceTable as PersesTraceTable } from '@perses-dev/trace-table-plugin';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { linkToTrace } from '../../links';
import './TraceTable.css';

interface TraceTableProps {
  setQuery: (query: string) => void;
}

export function TraceTable({ setQuery }: TraceTableProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');

  const noResults = (
    <EmptyState titleText={t('No results found')} headingLevel="h4" icon={SearchIcon}>
      <EmptyStateBody>
        {t('No results match this query criteria. Clear all filters and try again.')}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="link" onClick={() => setQuery('{}')}>
            {t('Clear all filters')}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );

  return (
    <div className="dt-plugin-trace-table">
      <PersesPanelPluginWrapper
        plugin={PersesTraceTable}
        noResults={noResults}
        spec={{
          visual: { palette: { mode: 'categorical' } },
          links: {
            trace: linkToTrace(),
          },
        }}
      />
    </div>
  );
}
