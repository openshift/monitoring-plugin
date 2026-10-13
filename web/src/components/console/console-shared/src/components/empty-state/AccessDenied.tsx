import { Alert, EmptyState, Flex, FlexItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import RestrictedSignImg from '../../../../imgs/restricted-sign.svg';

const RestrictedSignIcon = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return <img src={RestrictedSignImg} alt={t('Restricted access')} />;
};

export const AccessDenied = ({ message }: { message: string }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <EmptyState data-test="access-denied" icon={RestrictedSignIcon} title={t('Restricted access')}>
      <Flex direction={{ default: 'column' }}>
        <FlexItem>{t("You don't have access to this section due to cluster policy")}</FlexItem>
        <FlexItem>
          <Alert variant="danger" title={t('Error details')}>
            {message}
          </Alert>
        </FlexItem>
      </Flex>
    </EmptyState>
  );
};
