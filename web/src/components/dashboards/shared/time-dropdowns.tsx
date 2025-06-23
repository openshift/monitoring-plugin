import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, StackItem } from '@patternfly/react-core';
import { TimeRangeControls } from '@perses-dev/plugin-system';

export const TimeDropdowns: React.FC = React.memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Stack aria-label="Perses Time Range Controls">
      <StackItem>
        <b> {t('Time Range Controls')} </b>
      </StackItem>
      <StackItem>
        <TimeRangeControls />
      </StackItem>
    </Stack>
  );
});
