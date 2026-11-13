import { Form, FormGroup } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import { ControlledSimpleSelect } from '@/features/tracing/components/ControlledSelects';

export const DEFAULT_LIMIT = 20;
const limitOptions = [
  { content: '20', value: '20' },
  { content: '50', value: '50' },
  { content: '100', value: '100' },
  { content: '500', value: '500' },
  { content: '1000', value: '1000' },
  { content: '5000', value: '5000' },
];

interface LimitSelectProps {
  limit: number;
  setLimit: (limit: number) => void;
}

export function LimitSelect({ limit, setLimit }: LimitSelectProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Form>
      <FormGroup fieldId="limit-select" label={t('Max traces')}>
        <ControlledSimpleSelect
          id="limit-select"
          toggleWidth="8em"
          options={limitOptions}
          value={String(limit)}
          setValue={(x) => setLimit(parseInt(x))}
        />
      </FormGroup>
    </Form>
  );
}
