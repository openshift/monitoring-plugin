import * as React from 'react';
import { Alert } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

const ErrorAlert: React.FC<Props> = ({ message, title }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Alert
      isInline
      className="co-alert co-alert--scrollable"
      title={title || t('plugin__monitoring-plugin~An error occurred')}
      variant="danger"
    >
      {message}
    </Alert>
  );
};

type Props = {
  message: string;
  title?: string;
};

export default ErrorAlert;
