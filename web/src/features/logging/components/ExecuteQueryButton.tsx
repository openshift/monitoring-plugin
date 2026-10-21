import { Button, ButtonProps } from '@patternfly/react-core';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { TestIds } from '@/features/logging/utils/test-ids';

export const ExecuteQueryButton: FC<ButtonProps> = ({ onClick, isDisabled }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Button
      variant="primary"
      data-test={TestIds.ExecuteQueryButton}
      onClick={onClick}
      isDisabled={isDisabled}
    >
      {t('Run Query')}
    </Button>
  );
};
