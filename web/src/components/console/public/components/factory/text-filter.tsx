import { TextInput, TextInputProps } from '@patternfly/react-core';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { KEYBOARD_SHORTCUTS } from '../../../console-shared/constants/common';
import { useDocumentListener } from '../../../console-shared/hooks/useDocumentListener';

type TextFilterProps = Omit<TextInputProps, 'type' | 'tabIndex'> & {
  label?: string;
};

export const TextFilter: FC<TextFilterProps> = (props) => {
  const { label, placeholder, autoFocus = false, ...otherInputProps } = props;
  const { ref } = useDocumentListener<HTMLInputElement>();
  const { t } = useTranslation();
  const placeholderText = placeholder ?? t('Filter {{label}}...', { label });

  return (
    <div className="co-text-filter">
      <TextInput
        {...otherInputProps}
        className="co-text-filter__text-input"
        data-test-id="item-filter"
        aria-label={placeholderText}
        placeholder={placeholderText}
        ref={ref}
        autoFocus={autoFocus}
        tabIndex={0}
        type="text"
      />
      <span className="co-text-filter__feedback">
        <kbd className="co-kbd co-kbd__filter-input">{KEYBOARD_SHORTCUTS.focusFilterInput}</kbd>
      </span>
    </div>
  );
};
TextFilter.displayName = 'TextFilter';
