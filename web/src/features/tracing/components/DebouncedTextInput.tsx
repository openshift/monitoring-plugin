import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
  TextInputProps,
} from '@patternfly/react-core';
import { debounce } from 'lodash-es';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

export interface DebouncedTextInputProps extends TextInputProps {
  waitTime: number;
  validationRegex?: RegExp;
  validationFailedMessage?: string;
  value: string;
  setValue: (value: string) => void;
}

/**
 * <DebouncedTextInput> is a <TextInput> which validates the input (format e.g. 1s) and
 * debounces the onChange events until the user stopped typing for waitTime milliseconds, or the cursor left the input field.
 * Without debouncing, every keypress would trigger an API request and re-render.
 */
export function DebouncedTextInput({
  waitTime,
  validationRegex,
  validationFailedMessage,
  value,
  setValue,
  ...otherProps
}: DebouncedTextInputProps) {
  const [draftValue, setDraftValue] = useState(value);

  const isValidInput = useCallback(
    (x: string) => {
      return x == '' || validationRegex === undefined || validationRegex.test(x);
    },
    [validationRegex],
  );

  const debouncedSetValue = useMemo(() => {
    return debounce((newValue: string) => {
      if (isValidInput(newValue)) {
        setValue(newValue);
      }
    }, waitTime);
  }, [setValue, isValidInput, waitTime]);

  const handleChange = useCallback(
    (_event: FormEvent<HTMLInputElement>, newValue: string) => {
      setDraftValue(newValue);
      debouncedSetValue(newValue);
    },
    [debouncedSetValue],
  );

  const handleBlur = useCallback(() => {
    debouncedSetValue.flush();
  }, [debouncedSetValue]);

  useEffect(() => {
    setDraftValue(value); // eslint-disable-line react-hooks/set-state-in-effect
  }, [value, setDraftValue]);

  const validInput = isValidInput(draftValue);
  return (
    <>
      <TextInput
        {...otherProps}
        type="text"
        validated={validInput ? 'default' : 'error'}
        value={draftValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {!validInput && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
              {validationFailedMessage}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </>
  );
}
