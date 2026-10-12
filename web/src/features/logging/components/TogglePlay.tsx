import { Button, Icon } from '@patternfly/react-core';
import { PauseIcon, PlayIcon } from '@patternfly/react-icons';
import { FC, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import '@/features/logging/components/toggle-play.css';
import { TestIds } from '@/features/logging/test-ids';

interface TogglePlayProps {
  onClick?: (e: MouseEvent) => void;
  active?: boolean;
  isDisabled?: boolean;
}

export const TogglePlay: FC<TogglePlayProps> = ({ onClick, active, isDisabled = false }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Button
      icon={
        active ? (
          <Icon size="sm">
            <PauseIcon />
          </Icon>
        ) : (
          <Icon size="sm">
            <PlayIcon />
          </Icon>
        )
      }
      variant="plain"
      className={`lv-plugin__toggle-play ${active ? 'lv-plugin__toggle-play--active' : ''}`}
      onClick={onClick}
      aria-label={active ? t('Pause streaming') : t('Start streaming')}
      isDisabled={isDisabled}
      data-test={TestIds.ToogleStreamingButton}
    />
  );
};
