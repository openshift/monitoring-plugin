import { useCallback, useEffect, useRef } from 'react';
import { ToolbarGroup, ToolbarItem, Button, Form, FormGroup } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { TempoInstance } from '../../../hooks/useTempoInstance';
import { TraceQLEditor } from './TraceQLEditor';

interface TraceQLFilterProps {
  tempo: TempoInstance | undefined;
  query: string;
  runQuery: (query: string) => void;
}

export function TraceQLFilter({ tempo, query, runQuery }: TraceQLFilterProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');

  // For performance and UX reasons, the search results should not be refreshed on every key press of the TraceQL editor.
  // Also, the query editor should not be re-rendered on every key press.
  // Therefore we create a derived state, 'draftQuery', which holds the current query from the editor (which may or may have been executed).
  const draftQuery = useRef<string>(query);
  const setDraftQuery = useCallback((query: string) => {
    draftQuery.current = query;
  }, []);

  // Sync the draftQuery with the current executed query.
  useEffect(() => {
    draftQuery.current = query;
  }, [query]);

  const runDraftQuery = useCallback(() => {
    runQuery(draftQuery.current);
  }, [runQuery]);

  return (
    <>
      <ToolbarGroup variant="filter-group">
        <ToolbarItem style={{ width: '50em', flexDirection: 'column', alignItems: 'stretch' }}>
          <Form>
            <FormGroup fieldId="traceql-input" label={t('Query')}>
              <TraceQLEditor
                id="traceql-input"
                tempo={tempo}
                query={draftQuery.current} // eslint-disable-line react-hooks/refs
                setQuery={setDraftQuery}
                runQuery={runDraftQuery}
              />
            </FormGroup>
          </Form>
        </ToolbarItem>
      </ToolbarGroup>
      <ToolbarGroup variant="action-group">
        <ToolbarItem>
          <Form>
            <FormGroup label={<>&nbsp;</>}>
              <Button variant="primary" onClick={runDraftQuery}>
                {t('Run query')}
              </Button>
            </FormGroup>
          </Form>
        </ToolbarItem>
      </ToolbarGroup>
    </>
  );
}
