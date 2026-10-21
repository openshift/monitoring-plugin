import { Alert, Form, FormAlert, FormGroup, TextArea } from '@patternfly/react-core';
import { FC, KeyboardEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ExecuteQueryButton } from '@/features/logging/components/ExecuteQueryButton';
import '@/features/logging/components/logs-query-input.css';
import { LogQLQuery } from '@/features/logging/utils/logql-query';
import { TestIds } from '@/features/logging/utils/test-ids';

interface LogsQueryInputProps {
  value: string;
  onChange?: (expression: string) => void;
  onRun?: () => void;
  isDisabled?: boolean;
  invalidQueryErrorMessage?: string | null;
  tenant?: string;
}

export const LogsQueryInput: FC<LogsQueryInputProps> = ({
  value = '',
  onChange,
  onRun,
  isDisabled,
  invalidQueryErrorMessage,
  tenant,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [internalValue, setInternalValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      (e.ctrlKey || e.shiftKey || e.metaKey) &&
      e.key === 'Enter' &&
      internalValue.trim().length > 0
    ) {
      onRun?.();
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Imported control sync.
    setInternalValue(value);
    const parsedQuery = new LogQLQuery(value);

    // show invalid message only when query is empty for application tenant,
    // audit and infrastructure don't necessarily need a stream selector
    setIsValid(tenant === 'application' ? parsedQuery.streamSelector.length > 0 : true);
  }, [value, tenant]);

  const handleOnChange = (text: string) => {
    setInternalValue(text);
    onChange?.(text);
  };

  const hasError =
    !isValid || (invalidQueryErrorMessage !== undefined && invalidQueryErrorMessage !== null);

  return (
    <div
      className="lv-plugin__expression-input"
      data-test={TestIds.LogsQueryInput}
      data-test-query={value}
    >
      <Form className="lv-plugin__expression-input__form">
        {hasError && (
          <FormAlert>
            <Alert
              variant="danger"
              title={
                !isValid
                  ? t(
                      'Invalid log stream selector. Please select a namespace, pod or container as filter.',
                    )
                  : invalidQueryErrorMessage
              }
              aria-live="polite"
              isInline
            />
          </FormAlert>
        )}
        <FormGroup type="string" fieldId="selection">
          <TextArea
            className="lv-plugin__expression-input__searchInput"
            placeholder="LogQL Query"
            value={internalValue}
            onChange={(_event, text: string) => handleOnChange(text)}
            onKeyDown={handleKeyDown}
            aria-label="LogQL Query"
            validated={hasError ? 'error' : undefined}
          />
        </FormGroup>
      </Form>
      {onRun && (
        <ExecuteQueryButton
          onClick={onRun}
          isDisabled={value === undefined || value.length === 0 || isDisabled}
        />
      )}
    </div>
  );
};
