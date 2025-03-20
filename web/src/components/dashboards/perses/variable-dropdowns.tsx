import * as _ from 'lodash-es';
import { Tooltip, SelectOption } from '@patternfly/react-core';
import {
  DEFAULT_ALL_VALUE,
  ListVariableDefinition,
  VariableDefinition,
  VariableName,
} from '@perses-dev/core';

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { SingleTypeaheadDropdown } from '../../console/utils/single-typeahead-dropdown';

import {
  useListVariableState,
  useVariableDefinitionActions,
  useVariableDefinitionAndState,
  useVariableDefinitions,
} from '@perses-dev/dashboards';
import { useListVariablePluginValues, VariableOption } from '@perses-dev/plugin-system';

/**
 * This file is approximately the equal of `perses/ui/dashboards/src/components/Variables/Variable`
 * When we get to adding customizable actions to the dashboards we should reconsider what we
 * want to keep and what we want to reuse from perses
 */

const intervalVariableRegExps = ['__interval', '__rate_interval', '__auto_interval_[a-z]+'];

const isIntervalVariable = (itemKey: string): boolean =>
  _.some(intervalVariableRegExps, (re) => itemKey?.match(new RegExp(`\\$${re}`, 'g')));

const VariableOptionComponent = ({ value, isSelected, ...rest }) =>
  isIntervalVariable(String(value)) ? (
    <Tooltip content={value}>
      <SelectOption value={value} isSelected={isSelected || false}>
        Auto interval
      </SelectOption>
    </Tooltip>
  ) : (
    <SelectOption value={value} isSelected={isSelected || false} {...rest}>
      {value === DEFAULT_ALL_VALUE ? 'All' : value}
    </SelectOption>
  );

function ListVariable({ name, id }: VariableDropdownProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const ctx = useVariableDefinitionAndState(name);
  const definition = ctx.definition as ListVariableDefinition;
  const variablesOptionsQuery = useListVariablePluginValues(definition);
  const { setVariableValue, setVariableLoading, setVariableOptions } =
    useVariableDefinitionActions();
  const { selectedOptions, value, loading, options, viewOptions } = useListVariableState(
    definition?.spec,
    ctx.state,
    variablesOptionsQuery,
  );

  const allowAllValue = definition?.spec.allowAllValue === true;

  // Update value when changed
  React.useEffect(() => {
    if (value) {
      setVariableValue(name, value);
    }
  }, [setVariableValue, name, value]);

  // Update loading when changed
  React.useEffect(() => {
    setVariableLoading(name, loading);
  }, [setVariableLoading, name, loading]);

  // Update options when changed
  React.useEffect(() => {
    if (options) {
      setVariableOptions(name, options);
    }
  }, [setVariableOptions, name, options]);

  const onChangeFunction = React.useCallback(
    (value: string): void => {
      if ((value === null || (Array.isArray(value) && value.length === 0)) && allowAllValue) {
        setVariableValue(name, DEFAULT_ALL_VALUE);
      } else {
        setVariableValue(name, value);
      }
    },
    [setVariableValue, allowAllValue, name],
  );

  if (_.isEmpty(viewOptions)) {
    return null;
  }

  const singleSelectedItem = Array.isArray(selectedOptions)
    ? selectedOptions.at(0)
    : selectedOptions;

  const items: {
    value: string;
    children: string;
  }[] = _.map<VariableOption>(viewOptions, (option: VariableOption) => ({
    value: option.label,
    children: option.label,
  }));

  const title = definition?.spec.display?.name ?? name;

  return (
    <div data-test={`${name.toLowerCase()}-dropdown`}>
      <label htmlFor={`${id}-dropdown`}>{title}</label>
      <SingleTypeaheadDropdown
        items={items}
        onChange={onChangeFunction}
        OptionComponent={VariableOptionComponent}
        selectedKey={singleSelectedItem.label}
        hideClearButton
        resizeToFit
        placeholder={t('Select a dashboard from the dropdown')}
      />
    </div>
  );
}

export const AllVariableDropdowns: React.FC = () => {
  const variableDefinitions: VariableDefinition[] = useVariableDefinitions();

  if (!variableDefinitions) {
    return null;
  }

  return (
    <>
      {variableDefinitions.map((v) => (
        <VariableComponent key={v.spec.name} name={v.spec.name} />
      ))}
    </>
  );
};

export function VariableComponent({ name }: VariableProps) {
  const ctx = useVariableDefinitionAndState(name);
  const kind = ctx.definition?.kind;
  switch (kind) {
    // Openshift doesn't support this, so ignore for now
    // case 'TextVariable':
    // return <TextVariable name={name} source={source} />;
    case 'ListVariable':
      return <ListVariable id={name} name={name} />;
  }

  return <div>Unsupported Variable Kind: ${kind}</div>;
}

type VariableProps = {
  name: VariableName;
};

type VariableDropdownProps = {
  id: string;
  name: string;
};
