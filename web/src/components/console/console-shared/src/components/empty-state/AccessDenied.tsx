import type { FC } from 'react';
import { Alert, Flex, FlexItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ConsoleEmptyState } from './ConsoleEmptyState';
import * as restrictedSignImg from '../../../../imgs/restricted-sign.svg';

const RestrictedSignIcon = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return <img src={restrictedSignImg} alt={t('Restricted access')} />;
};

export const AccessDenied: FC = ({ children }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ConsoleEmptyState
      data-test="access-denied"
      Icon={RestrictedSignIcon}
      title={t('Restricted access')}
    >
      <Flex direction={{ default: 'column' }}>
        <FlexItem>{t("You don't have access to this section due to cluster policy")}</FlexItem>
        {children && (
          <FlexItem>
            <Alert variant="danger" title={t('Error details')}>
              {children}
            </Alert>
          </FlexItem>
        )}
      </Flex>
    </ConsoleEmptyState>
  );
};
AccessDenied.displayName = 'AccessDenied';
