import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ConsoleEmptyState } from './ConsoleEmptyState';

export const EmptyBox: React.FCC<EmptyBoxProps> = ({ label }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ConsoleEmptyState data-test="empty-box">
      {label ? t('No {{label}} found', { label }) : t('Not found')}
    </ConsoleEmptyState>
  );
};
EmptyBox.displayName = 'EmptyBox';

type EmptyBoxProps = {
  label?: string;
};
