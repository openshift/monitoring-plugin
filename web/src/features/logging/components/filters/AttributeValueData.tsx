import { useCallback, useState } from 'react';

import { Attribute, Filters, Option } from '@/features/logging/components/filters/filter-types';
import { useBoolean } from '@/features/logging/hooks/useBoolean';

type UseAttributeValueDataHookResult = {
  getAttributeOptions: (filters?: Filters) => void;
  attributeOptions: Array<Option>;
  attributeError: Error | undefined;
  attributeLoading: boolean;
};

const uniqueOptions = (options: Array<Option>): Array<Option> =>
  Array.from(new Set(options.map(({ option, value }) => `${option}|||${value}`))).map((str) => {
    const [option, value] = str.split('|||');
    return { option, value };
  });

export const useAttributeValueData = (attribute: Attribute): UseAttributeValueDataHookResult => {
  const [attributeOptions, setAttributeOptions] = useState<Array<Option>>([]);
  const { value: attributeLoading, setValue: setAttributeLoading } = useBoolean(true);
  const [attributeError, setAttributeError] = useState<Error | undefined>();

  const getAttributeOptions = useCallback(
    (filters?: Filters) => {
      setAttributeError(undefined);
      if (attribute.options) {
        if (Array.isArray(attribute.options)) {
          setAttributeLoading(false);
          setAttributeOptions(uniqueOptions(attribute.options));
        } else {
          attribute
            .options(filters)
            .then((asyncOptions) => {
              setAttributeOptions(uniqueOptions(asyncOptions ?? []));
            })
            .catch((searchError) => {
              try {
                const jsonError = JSON.parse(searchError.message);
                setAttributeError(jsonError.message || searchError);
              } catch {
                setAttributeError(searchError);
              }
            })
            .finally(() => setAttributeLoading(false));
        }
      }
    },
    [attribute, setAttributeLoading],
  );

  return { getAttributeOptions, attributeOptions, attributeError, attributeLoading };
};
