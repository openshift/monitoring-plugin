import { Alert } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

export const SilenceEditInfo = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Alert isInline title={t('Overwriting current silence')} variant="info">
      {t(
        'When changes are saved, the currently existing silence will be expired and a new silence with the new configuration will take its place.',
      )}
    </Alert>
  );
};
