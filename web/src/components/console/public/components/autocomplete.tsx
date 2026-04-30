import type { ComponentProps, FC, SetStateAction, Dispatch, FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { css } from '@patternfly/react-styles';
import * as _ from 'lodash-es';

import { TextFilter } from './factory/text-filter';
import { Label, SelectList } from '@patternfly/react-core';
import { KeyEventModes, useDocumentListener } from '../../console-shared/hooks/useDocumentListener';
import {
  requirementToString,
  toRequirements,
} from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s';
import { fuzzyCaseInsensitive } from '../../../utils';

const mapLabelsToStrings = (labels: { [key: string]: string }): string[] => {
  const requirements = toRequirements(labels);
  return _.map(requirements, requirementToString);
};

const getLabelsAsString = (obj: any, path = 'metadata.labels'): string[] => {
  const labels = _.get(obj, path);
  return _.isPlainObject(labels) ? mapLabelsToStrings(labels as Record<string, string>) : [];
};

const MAX_SUGGESTIONS = 5;

const labelParser = (resources: any = [], labelPath = 'metadata.labels'): Set<string> => {
  const safeResources = Array.isArray(resources) ? resources : [];
  return safeResources.reduce((acc: Set<string>, resource: any) => {
    getLabelsAsString(resource, labelPath).forEach((label) => acc.add(label));
    return acc;
  }, new Set<string>());
};

const suggestionBoxKeyHandler = {
  Escape: KeyEventModes.HIDE,
};

type SuggestionLineProps = {
  suggestion: string;
  onClick: (param: string) => void;
  color: ComponentProps<typeof Label>['color'];
};

const SuggestionLine: FC<SuggestionLineProps> = ({ suggestion, onClick, color }) => {
  return (
    <div>
      <Label
        variant="outline"
        onClick={() => onClick(suggestion)}
        data-test="suggestion-line"
        color={color}
      >
        {suggestion}
      </Label>
    </div>
  );
};

type AutocompleteInputProps = {
  onSuggestionSelect: (selected: string) => void;
  placeholder?: string;
  suggestionCount?: number;
  showSuggestions?: boolean;
  textValue: string;
  setTextValue: Dispatch<SetStateAction<string>>;
  color?: SuggestionLineProps['color'];
  data?: any;
  labelPath?: string;
};

const AutocompleteInput: FC<AutocompleteInputProps> = (props) => {
  const [suggestions, setSuggestions] = useState<string[]>();
  const { visible, setVisible, ref } = useDocumentListener<HTMLDivElement>(suggestionBoxKeyHandler);
  const {
    textValue,
    setTextValue,
    onSuggestionSelect,
    placeholder,
    suggestionCount,
    showSuggestions,
    data,
    color,
    labelPath,
  } = props;

  const onSelect = (value: string) => {
    onSuggestionSelect(value);
    if (visible) {
      setVisible(false);
    }
  };

  const activate = () => {
    if (textValue.trim()) {
      setVisible(true);
    }
  };

  const handleInput = (event: FormEvent<HTMLInputElement>, input: string) => {
    if (input) {
      setVisible(true);
    } else {
      setVisible(false);
    }
    setTextValue(input);
  };

  useEffect(() => {
    if (textValue && visible && showSuggestions) {
      const processed = labelParser(data, labelPath);
      // User input without whitespace
      const processedText = textValue.trim().replace(/\s*=\s*/, '=');
      const maxSuggestions = suggestionCount ?? MAX_SUGGESTIONS;
      const filtered = [...processed]
        .filter((item) => fuzzyCaseInsensitive(processedText, item))
        .slice(0, maxSuggestions);
      setSuggestions(filtered);
    }
  }, [visible, textValue, showSuggestions, data, labelPath, suggestionCount]);

  return (
    <div className="co-suggestion-box" ref={ref}>
      <TextFilter
        value={textValue}
        onChange={handleInput}
        placeholder={placeholder}
        onFocus={activate}
      />
      {showSuggestions && (
        <SelectList
          className={css('co-suggestion-box__suggestions', {
            'co-suggestion-box__suggestions--shadowed': visible && suggestions?.length > 0,
          })}
        >
          {visible &&
            suggestions?.map((elem) => (
              <SuggestionLine suggestion={elem} key={elem} onClick={onSelect} color={color} />
            ))}
        </SelectList>
      )}
    </div>
  );
};

export default AutocompleteInput;
