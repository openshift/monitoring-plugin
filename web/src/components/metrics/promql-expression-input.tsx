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
import { PrometheusEndpoint, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInputGroup,
  TextInputGroupUtilities,
  ValidatedOptions,
} from '@patternfly/react-core';
import { CloseIcon, ExclamationCircleIcon } from '@patternfly/react-icons';
import { PromQLExtension } from '@prometheus-io/codemirror-promql';
import type { FC } from 'react';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSafeFetch } from '../console/utils/safe-fetch-hook';

import { PROMETHEUS_BASE_PATH, PROMETHEUS_TENANCY_BASE_PATH } from '../console/graphs/helpers';
import { LabelNamesResponse } from '@perses-dev/prometheus-plugin';
import {
  t_global_color_status_custom_default,
  t_global_color_status_danger_default,
  t_global_color_status_success_default,
  t_global_color_status_warning_default,
  t_global_font_weight_body_bold,
  t_global_text_color_disabled,
  t_global_text_color_regular,
  t_global_spacer_xs,
  t_global_text_color_subtle,
  t_global_font_family_mono,
  t_global_font_size_sm,
  t_global_color_brand_default,
  t_global_color_nonstatus_yellow_default,
  t_global_color_nonstatus_purple_default,
} from '@patternfly/react-tokens';
import { usePatternFlyTheme } from '../hooks/usePatternflyTheme';
import { usePerspective } from '../hooks/usePerspective';

const box_shadow = `
    var(--pf-t--global--box-shadow--X--md--default)
    var(--pf-t--global--box-shadow--Y--md--default)
    var(--pf-t--global--box-shadow--blur--md)
    var(--pf-t--global--box-shadow--spread--md--default)
    var(--pf-t--global--box-shadow--color--md--default)
`;

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

const theme = (darkTheme: boolean) =>
  EditorView.theme(
    {
      '.cm-scroller': {
        fontFamily: 'inherit',
      },
      '.cm-content': {
        caretColor: 'auto',
      },
      '&.cm-focused.cm-editor': {
        outline: 'none',
      },
      '.cm-tooltip.cm-completionInfo': {
        backgroundColor: 'var(--pf-t--global--background--color--floating--default)',
        boxShadow: box_shadow,
        marginTop: '-11px',
        padding: '10px',
      },
      '.cm-completionInfo-right': {
        '&:before': {
          content: "' '",
          height: '0',
          position: 'absolute',
          width: '0',
          left: '-20px',
          borderWidth: '10px',
          borderStyle: 'solid',
          borderColor: 'transparent',
          borderRightColor: 'var(--pf-t--global--background--color--floating--default)',
        },
        marginLeft: '12px',
      },
      '.cm-completionInfo-left': {
        '&:before': {
          content: "' '",
          height: '0',
          position: 'absolute',
          width: '0',
          right: '-20px',
          borderWidth: '10px',
          borderStyle: 'solid',
          borderColor: 'transparent',
          borderLeftColor: 'var(--pf-t--global--background--color--floating--default)',
        },
        marginRight: '12px',
      },
      '.cm-completionIcon': {
        fontFamily: 'codicon',
        width: '1.5em',
        verticalAlign: 'middle',
      },
      '.cm-selectionMatch': {
        backgroundColor: 'var(--pf-t--global--background--color--floating--hover)',
      },
      '.cm-completionDetail': {
        float: 'right',
        color: t_global_text_color_subtle.var,
      },
      '.cm-tooltip': {
        backgroundColor: 'var(--pf-t--global--background--color--floating--default)',
        borderRadius: 'var(--pf-t--global--border--radius--small)',
        borderStyle: 'solid',
        borderWidth: '0px',
        borderColor: 'transparent',
        boxShadow: box_shadow,
        color: t_global_text_color_regular.var,
      },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        '& > ul': {
          fontFamily: t_global_font_family_mono.var,
          fontSize: t_global_font_size_sm.var,
        },
        '& > ul > li[aria-selected]': {
          backgroundColor: 'var(--pf-t--global--background--color--floating--hover)',
          color: 'unset',
          '&:first-child': {
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: 'transparent',
          },
          '&:last-child': {
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: 'transparent',
          },
        },
        '& > ul > li': {
          padding: '2px 1em 2px 3px',
          '&:first-child': {
            marginTop: t_global_spacer_xs.var,
          },
          '&:last-child': {
            marginBottom: t_global_spacer_xs.var,
          },
        },
      },
      '.cm-completionMatchedText': {
        textDecoration: 'none',
        fontWeight: 'bold',
        color: t_global_color_brand_default.var,
      },
      '.cm-completionIcon-function, .cm-completionIcon-method': {
        '&:after': { content: "'\\ea8c'" },
        color: t_global_color_nonstatus_purple_default.var,
      },
      '.cm-completionIcon-class': {
        '&:after': { content: "'○'" },
      },
      '.cm-completionIcon-interface': {
        '&:after': { content: "'◌'" },
      },
      '.cm-completionIcon-variable': {
        '&:after': { content: "'𝑥'" },
      },
      '.cm-completionIcon-constant': {
        '&:after': { content: "'\\eb5f'" },
        color: t_global_color_brand_default.var,
      },
      '.cm-completionIcon-type': {
        '&:after': { content: "'𝑡'" },
      },
      '.cm-completionIcon-enum': {
        '&:after': { content: "'∪'" },
      },
      '.cm-completionIcon-property': {
        '&:after': { content: "'□'" },
      },
      '.cm-completionIcon-keyword': {
        '&:after': { content: "'\\eb62'" },
        color: t_global_text_color_regular.var,
      },
      '.cm-completionIcon-namespace': {
        '&:after': { content: "'▢'" },
      },
      '.cm-completionIcon-text': {
        '&:after': { content: "'\\ea95'" },
        color: t_global_color_nonstatus_yellow_default.var,
      },
    },
    { dark: darkTheme },
  );

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
  { tag: tags.name, color: t_global_text_color_regular.var },
  {
    tag: tags.number,
    color: t_global_color_status_success_default.var,
  },
  {
    tag: tags.string,
    color: t_global_color_status_danger_default.var,
  },
  {
    tag: tags.keyword,
    color: t_global_color_status_custom_default.var,
    fontWeight: t_global_font_weight_body_bold.var,
  },
  {
    tag: tags.function(tags.variableName),
    color: t_global_color_status_custom_default.var,
    fontWeight: t_global_font_weight_body_bold.var,
  },
  {
    tag: tags.labelName,
    color: t_global_color_status_warning_default.var,
  },
  { tag: tags.operator },
  {
    tag: tags.modifier,
    color: t_global_color_status_custom_default.var,
    fontWeight: t_global_font_weight_body_bold.var,
  },
  { tag: tags.paren },
  { tag: tags.squareBracket },
  { tag: tags.brace },
  { tag: tags.invalid, color: t_global_color_status_danger_default.var },
  { tag: tags.comment, color: t_global_text_color_disabled.var, fontStyle: 'italic' },
]);

export const PromQLExpressionInput: FC<PromQLExpressionInputProps> = ({
  value,
  onExecuteQuery,
  onValueChange,
  onSelectionChange,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { theme: pfTheme } = usePatternFlyTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [metricNames, setMetricNames] = useState<Array<string>>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const { perspective } = usePerspective();
  const placeholder = t('Expression (press Shift+Enter for newlines)');
  const [namespace] = useActiveNamespace();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);

  useEffect(() => {
    let url = `${PROMETHEUS_BASE_PATH}/${PrometheusEndpoint.LABEL}/__name__/values`;
    if (perspective === 'dev') {
      // eslint-disable-next-line max-len
      url = `${PROMETHEUS_TENANCY_BASE_PATH}/${PrometheusEndpoint.LABEL}/__name__/values?namespace=${namespace}`;
    }
    safeFetch<LabelNamesResponse>(url)
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
  }, [safeFetch, t, namespace, perspective]);

  const onClear = () => {
    if (viewRef.current !== null) {
      const length = viewRef.current.state.doc.toString().length;
      viewRef.current.dispatch({ changes: { from: 0, to: length } });
    }
    onValueChange('');
  };

  useEffect(() => {
    if (viewRef.current !== null) {
      const currentExpression = viewRef.current.state.doc.toString();
      if (currentExpression !== value) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentExpression.length, insert: value },
        });
      }
    }
  }, [value]);

  const target = useMemo(
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

  useEffect(() => {
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
          theme(pfTheme === 'dark'),
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
  }, [
    metricNames,
    onValueChange,
    onExecuteQuery,
    placeholder,
    value,
    onSelectionChange,
    target,
    pfTheme,
  ]);

  const handleBlur = () => {
    if (viewRef.current !== null) {
      closeCompletion(viewRef.current);
    }
  };

  return (
    <Form>
      <FormGroup>
        <TextInputGroup validated={errorMessage ? ValidatedOptions.error : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: '0.5rem' }}>
            <div
              ref={containerRef}
              onBlur={handleBlur}
              style={{ width: '100%', marginTop: t_global_spacer_xs.var }}
            />
          </div>
          <TextInputGroupUtilities>
            <Button
              variant="plain"
              onClick={onClear}
              aria-label={t('Clear query')}
              icon={<CloseIcon />}
            />
          </TextInputGroupUtilities>
        </TextInputGroup>
        {errorMessage && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem icon={<ExclamationCircleIcon />} variant={ValidatedOptions.error}>
                {errorMessage}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
    </Form>
  );
};
