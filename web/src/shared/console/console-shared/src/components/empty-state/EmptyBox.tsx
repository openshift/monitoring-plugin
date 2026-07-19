import { useTranslation } from 'react-i18next';

import { ConsoleEmptyState } from '@/shared/console/console-shared/src/components/empty-state/ConsoleEmptyState';

export const EmptyBox = ({ label, customMessage }: EmptyBoxProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ConsoleEmptyState data-test="empty-box">
      {customMessage ? customMessage : label ? t('No {{label}} found', { label }) : t('Not found')}
    </ConsoleEmptyState>
  );
};
EmptyBox.displayName = 'EmptyBox';

type EmptyBoxProps = {
  label?: string;
  customMessage?: string;
};
