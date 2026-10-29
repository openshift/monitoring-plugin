import { Button, ButtonProps, Tooltip } from '@patternfly/react-core';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { TestIds } from '@/features/logging/utils/test-ids';

export const ExecuteVolumeButton: FC<ButtonProps> = ({ onClick, isDisabled }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Tooltip content={t('Gives the volume of data for the given stream selector')}>
      <Button
        variant="secondary"
        data-test={TestIds.ExecuteVolumeButton}
        onClick={onClick}
        isDisabled={isDisabled}
      >
        {t('Explain Log Volume')}
      </Button>
    </Tooltip>
  );
};
