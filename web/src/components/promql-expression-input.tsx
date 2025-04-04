import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  closeCompletion,
  completionKeymap,
  currentCompletions,
  setSelectedCompletion,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  historyKeymap,
  history,
  insertNewlineAndIndent,
} from '@codemirror/commands';
import {
  indentOnInput,
  HighlightStyle,
  bracketMatching,
  syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches } from '@codemirror/search';
import { EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  highlightSpecialChars,
  keymap,
  placeholder as codeMirrorPlaceholder,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import {
  PrometheusEndpoint,
  YellowExclamationTriangleIcon,
} from '@openshift-console/dynamic-plugin-sdk';
import { Button } from '@patternfly/react-core';
import { CloseIcon } from '@patternfly/react-icons';
import { PromQLExtension } from '@prometheus-io/codemirror-promql';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { useSafeFetch } from './console/utils/safe-fetch-hook';

// import './_promql-expression-input.scss';
import { PROMETHEUS_BASE_PATH } from './console/graphs/helpers';

type InteractionTarget = {
  focus: () => void;
  setSelectionRange: (from: number, to: number) => void;
};

interface PromQLExpressionInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onExecuteQuery?: () => void;
  onSelectionChange?: (target: InteractionTarget, start: number, end: number) => void;
}

const promqlExtension = new PromQLExtension();

export const theme = EditorView.theme({});

// Codemirror plugin to select an autosuggest option using the mouse
export const selectAutocompleteOnHoverPlugin = ViewPlugin.fromClass(
  class SelectAutocompleteOnHoverPlugin {
    optionsLength = 0;
    lastIndex = -1;

    constructor(readonly view: EditorView) {
      this.view.dom.addEventListener('mousemove', (this.onMouseMove = this.onMouseMove.bind(this)));
    }

    update(update: ViewUpdate) {
      this.optionsLength = currentCompletions(update.state).length;
    }

    findHoveredOptionIndex(dom: HTMLElement) {
      let listItem: HTMLElement | null = null;

      while (dom && dom !== this.view.dom) {
        if (dom.nodeName === 'LI') {
          listItem = dom;
          break;
        }
        dom = dom.parentElement;
      }

      if (!listItem || !listItem.parentNode) {
        return -1;
      }

      return Array.from(listItem.parentNode.children).indexOf(listItem);
    }

    onMouseMove(e: Event) {
      const element = e.target;
      const index = this.findHoveredOptionIndex(element as HTMLElement);

      if (index >= 0 && this.lastIndex !== index) {
        this.lastIndex = index;
        this.view.dispatch({ effects: setSelectedCompletion(index) });
      }
    }

    destroy() {
      this.view.dom.removeEventListener('mousemove', this.onMouseMove);
    }
  },
);

export const promqlHighlighter = HighlightStyle.define([
  { tag: tags.name, color: '#000' },
  {
    tag: tags.number,
    color:
      'var(--pf-t--temp--dev--tbd)' /* CODEMODS: original v5 color was --pf-v5-global--success-color--100 */,
  },
  {
    tag: tags.string,
    color:
      'var(--pf-t--temp--dev--tbd)' /* CODEMODS: original v5 color was --pf-v5-global--danger-color--200 */,
  },
  {
    tag: tags.keyword,
    color:
      'var(--pf-t--temp--dev--tbd)' /* CODEMODS: original v5 color was --pf-v5-global--custom-color--200 */,
    fontWeight: 'bold',
  },
  {
    tag: tags.function(tags.variableName),
    color:
      'var(--pf-t--temp--dev--tbd)' /* CODEMODS: original v5 color was --pf-v5-global--custom-color--200 */,
    fontWeight: 'bold',
  },
  {
    tag: tags.labelName,
    color:
      'var(--pf-t--temp--dev--tbd)' /* CODEMODS: original v5 color was --pf-v5-global--warning-color--200 */,
  },
  { tag: tags.operator },
  {
    tag: tags.modifier,
    color:
      'var(--pf-t--temp--dev--tbd)' /* CODEMODS: original v5 color was --pf-v5-global--custom-color--200 */,
    fontWeight: 'bold',
  },
  { tag: tags.paren },
  { tag: tags.squareBracket },
  { tag: tags.brace },
  { tag: tags.invalid, color: 'red' },
  { tag: tags.comment, color: '#888', fontStyle: 'italic' },
]);

export const PromQLExpressionInput: React.FC<PromQLExpressionInputProps> = ({
  value,
  onExecuteQuery,
  onValueChange,
  onSelectionChange,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const [metricNames, setMetricNames] = React.useState<Array<string>>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  const placeholder = t('Expression (press Shift+Enter for newlines)');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);

  React.useEffect(() => {
    safeFetch(`${PROMETHEUS_BASE_PATH}/${PrometheusEndpoint.LABEL}/__name__/values`)
      .then((response) => {
        const metrics = response?.data;
        setMetricNames(metrics);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          const message =
            err?.response?.status === 403
              ? t('Access restricted.')
              : t('Failed to load metrics list.');
          setErrorMessage(message);
        }
      });
  }, [safeFetch, t]);

  const onClear = () => {
    if (viewRef.current !== null) {
      const length = viewRef.current.state.doc.toString().length;
      viewRef.current.dispatch({ changes: { from: 0, to: length } });
    }
    onValueChange('');
  };

  React.useEffect(() => {
    if (viewRef.current !== null) {
      const currentExpression = viewRef.current.state.doc.toString();
      if (currentExpression !== value) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentExpression.length, insert: value },
        });
      }
    }
  }, [value]);

  const target = React.useMemo(
    () => ({
      focus: () => viewRef.current.focus(),
      setSelectionRange: (from: number, to: number) => {
        viewRef.current.dispatch({
          selection: { anchor: from, head: to },
        });
      },
    }),
    [],
  );

  React.useEffect(() => {
    promqlExtension.setComplete({
      remote: {
        url: PROMETHEUS_BASE_PATH,
        httpMethod: 'GET',
        cache: { initialMetricList: metricNames },
      },
    });

    if (viewRef.current === null) {
      if (!containerRef.current) {
        throw new Error('expected CodeMirror container element to exist');
      }

      const startState = EditorState.create({
        doc: value,
        extensions: [
          theme,
          highlightSpecialChars(),
          history(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          selectAutocompleteOnHoverPlugin,
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': placeholder }),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            ...lintKeymap,
          ]),
          codeMirrorPlaceholder(placeholder),
          syntaxHighlighting(promqlHighlighter),
          promqlExtension.asExtension(),
          keymap.of([
            {
              key: 'Escape',
              run: (v: EditorView): boolean => {
                v.contentDOM.blur();
                return false;
              },
            },
          ]),
          Prec.highest(
            keymap.of([
              {
                key: 'Enter',
                run: (): boolean => {
                  onExecuteQuery?.();
                  return true;
                },
              },
              {
                key: 'Shift-Enter',
                run: insertNewlineAndIndent,
              },
            ]),
          ),
          EditorView.updateListener.of((update: ViewUpdate): void => {
            const { from, to } = update.state.selection.main;
            onSelectionChange?.(target, from, to);

            const expressionValue = update.state.doc.toString();
            onValueChange(expressionValue);
          }),
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: containerRef.current,
      });

      viewRef.current = view;

      view.focus();
    }
  }, [metricNames, onValueChange, onExecuteQuery, placeholder, value, onSelectionChange, target]);

  const handleBlur = () => {
    if (viewRef.current !== null) {
      closeCompletion(viewRef.current);
    }
  };

  return (
    <div>
      <div ref={containerRef} onBlur={handleBlur}></div>
      {errorMessage && (
        <div id="helper-text-promql-expression-input" aria-live="polite">
          <div>
            <div>
              <YellowExclamationTriangleIcon />
              <span>{errorMessage}</span>
            </div>
          </div>
        </div>
      )}
      <Button
        icon={<CloseIcon />}
        aria-label={t('Clear query')}
        onClick={onClear}
        variant="plain"
      />
    </div>
  );
};
