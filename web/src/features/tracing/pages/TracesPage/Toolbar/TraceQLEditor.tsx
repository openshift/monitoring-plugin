import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import { TraceQLExtension, TempoDatasource } from '@perses-dev/tempo-plugin';
import { TempoInstance } from '../../../hooks/useTempoInstance';
import { getProxyURLFor } from '../../../hooks/api';
import { usePatternFlyTheme } from '../../../components/console/utils/usePatternFlyTheme';
import { Prec } from '@codemirror/state';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { useTimeRange } from '@perses-dev/plugin-system';

interface TraceQLEditorProps {
  id?: string;
  tempo: TempoInstance | undefined;
  query: string;
  setQuery: (query: string) => void;
  runQuery: () => void;
}

export const codemirrorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent !important',
  },
  '.cm-content': {
    padding: 0,
  },
  '.cm-line': {
    padding: 0,
  },
  '&.cm-focused.cm-editor': {
    outline: 'none',
  },
});

export function TraceQLEditor({ id, tempo, query, setQuery, runQuery }: TraceQLEditorProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { theme } = usePatternFlyTheme();
  const { absoluteTimeRange } = useTimeRange();

  const traceQLExtension = useMemo(() => {
    const client = tempo
      ? TempoDatasource.createClient({ directUrl: getProxyURLFor(tempo) }, {})
      : undefined;
    return TraceQLExtension({ client, timeRange: absoluteTimeRange });
  }, [tempo, absoluteTimeRange]);

  const keyBindings = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: 'Enter',
            run: () => {
              runQuery();
              return true;
            },
          },
          {
            key: 'Shift-Enter',
            run: insertNewlineAndIndent,
          },
        ]),
      ),
    [runQuery],
  );

  return (
    <CodeMirror
      id={id}
      style={{
        border:
          'var(--pf-t--global--border--width--control--default) solid var(--pf-t--global--border--color--default)',
        borderRadius: 'var(--pf-t--global--border--radius--small)',
        padding:
          'var(--pf-t--global--spacer--control--vertical--default) var(--pf-t--global--spacer--control--horizontal--default)',
      }}
      theme={theme == 'dark' ? 'dark' : 'light'}
      aria-label="trace query input"
      placeholder={t('TraceQL Query')}
      value={query}
      onChange={setQuery}
      basicSetup={{
        lineNumbers: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        foldGutter: false,
      }}
      extensions={[EditorView.lineWrapping, traceQLExtension, codemirrorTheme, keyBindings]}
    />
  );
}
