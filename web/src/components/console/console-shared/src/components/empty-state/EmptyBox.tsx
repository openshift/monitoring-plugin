import type { FCC } from 'react';
import { useTranslation } from 'react-i18next';
import { ConsoleEmptyState } from './ConsoleEmptyState';

export const EmptyBox: FCC<EmptyBoxProps> = ({ label, customMessage }) => {
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
