import {
  Alert,
  AlertVariant,
  Panel,
  PanelMain,
  PanelMainBody,
  Title,
} from '@patternfly/react-core';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

type ErrorProps = {
  error?: any;
};

const Error: FC<ErrorProps> = ({ error }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const status = error?.response?.status;

  if (status === 404) {
    return (
      <Panel>
        <PanelMain>
          <PanelMainBody>
            <Title headingLevel="h2">{t('404: Not Found')}</Title>
          </PanelMainBody>
        </PanelMain>
      </Panel>
    );
  }
  return (
    <Alert isInline title={t('Error')} variant={AlertVariant.danger}>
      {error?.message}
    </Alert>
  );
};

export default Error;
