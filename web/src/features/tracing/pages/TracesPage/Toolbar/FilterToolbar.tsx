import {
  Button,
  Form,
  FormGroup,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  ToolbarToggleGroup,
} from '@patternfly/react-core';
import { FilterIcon } from '@patternfly/react-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TempoInstanceDropdown } from '@/features/tracing/components/TempoInstanceDropdown';
import { TempoInstance } from '@/features/tracing/hooks/useTempoInstance';
import { AttributeFilters } from '@/features/tracing/pages/TracesPage/Toolbar/AttributeFilters';
import { filterToTraceQL } from '@/features/tracing/pages/TracesPage/Toolbar/Filter/traceql-from-filter';
import { traceQLToFilter } from '@/features/tracing/pages/TracesPage/Toolbar/Filter/traceql-to-filter';
import { TraceQLFilter } from '@/features/tracing/pages/TracesPage/Toolbar/TraceQLFilter';
import '@/features/tracing/pages/TracesPage/Toolbar/FilterToolbar.css';

interface FilterToolbarProps {
  tempo: TempoInstance | undefined;
  setTempo: (tempo?: TempoInstance) => void;
  query: string;
  /** Update and execute the query. Always fetches the search results. */
  runQuery: (query: string) => void;
}

export function FilterToolbar(props: FilterToolbarProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { tempo, setTempo, query, runQuery } = props;
  const [showAttributeFilters, setShowAttributeFilters] = useState(isSimpleTraceQLQuery(query));

  return (
    <Toolbar
      customLabelGroupContent={<div className="df-filter-toolbar-clearallfilters" />}
      hasNoPadding
      className="df-filter-toolbar"
    >
      <ToolbarContent>
        <TempoInstanceDropdown tempo={tempo} setTempo={setTempo} />
        <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
          {showAttributeFilters ? (
            <AttributeFilters tempo={tempo} query={query} runQuery={runQuery} />
          ) : (
            <TraceQLFilter tempo={tempo} query={query} runQuery={runQuery} />
          )}
        </ToolbarToggleGroup>
        <ToolbarGroup variant="action-group" align={{ default: 'alignEnd' }} alignItems="center">
          <ToolbarItem>
            <Form>
              <FormGroup label={<>&nbsp;</>}>
                <Button
                  variant="link"
                  onClick={() => setShowAttributeFilters(!showAttributeFilters)}
                >
                  {showAttributeFilters ? t('Show query') : t('Hide query')}
                </Button>
              </FormGroup>
            </Form>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
}

function isSimpleTraceQLQuery(query: string) {
  // if a query can be transformed to a filter and back to the original query, we can show the
  // attribute filter toolbar
  return filterToTraceQL(traceQLToFilter(query)) === query;
}
