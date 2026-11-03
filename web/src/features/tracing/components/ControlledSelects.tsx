import { useMemo } from 'react';
import { SimpleSelect, SimpleSelectOption, SimpleSelectProps } from '@patternfly/react-templates';
import { TypeaheadSelect, TypeaheadSelectOption, TypeaheadSelectProps } from './TypeaheadSelect';

// This file provides controlled variants of the Select components of the @patternfly/react-templates package.

interface ControlledSimpleSelectProps extends Omit<SimpleSelectProps, 'initialOptions'> {
  options: SimpleSelectOption[];
  value?: string;
  setValue: (value: string) => void;
}

export function ControlledSimpleSelect(props: ControlledSimpleSelectProps) {
  const { options, value, setValue, ...otherProps } = props;
  const initialOptions = useMemo(
    () => options.map((o) => ({ ...o, selected: o.value === value })),
    [options, value],
  );

  return (
    <SimpleSelect
      {...otherProps}
      initialOptions={initialOptions}
      onSelect={(_ev, selection) => setValue(String(selection))}
    />
  );
}

interface ControlledTypeaheadSelectProps extends Omit<TypeaheadSelectProps, 'initialOptions'> {
  options: TypeaheadSelectOption[];
  value?: string;
  setValue: (value?: string) => void;
}

export function ControlledTypeaheadSelect(props: ControlledTypeaheadSelectProps) {
  const { options, value, setValue, ...otherProps } = props;
  const initialOptions = useMemo(() => {
    const initialOptions = options.map((o) => ({ ...o, selected: o.value === value }));
    if (props.isCreatable && value && !initialOptions.find((o) => o.selected)) {
      initialOptions.push({ content: value, value, selected: true });
    }
    return initialOptions;
  }, [options, value, props.isCreatable]);

  return (
    <TypeaheadSelect
      {...otherProps}
      initialOptions={initialOptions}
      onClearSelection={() => setValue(undefined)}
      onSelect={(_ev, selection) => setValue(String(selection))}
    />
  );
}
