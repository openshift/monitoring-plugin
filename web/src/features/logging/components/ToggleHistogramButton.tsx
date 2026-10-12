import { ChartBarIcon, CompressIcon } from '@patternfly/react-icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { ToggleButton } from '@/features/logging/components/ToggleButton';

interface ToggleHistogramButtonProps {
  isToggled: boolean;
  isDisabled?: boolean;
  onToggle?: (isToggled: boolean) => void;
}

export const ToggleHistogramButton: FC<ToggleHistogramButtonProps> = (props) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <ToggleButton
      toggledIcon={<CompressIcon />}
      untoggledIcon={<ChartBarIcon />}
      toggledText={t('Hide Histogram')}
      untoggledText={t('Show Histogram')}
      {...props}
    />
  );
};
