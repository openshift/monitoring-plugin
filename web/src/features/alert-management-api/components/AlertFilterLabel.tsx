import { Button, Tooltip } from '@patternfly/react-core';
import { HelpIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

export function AlertFilterLabel({ label, tooltip }: { label: string; tooltip: string }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div>
      <strong>{t(label)}</strong>
      <Tooltip content={t(tooltip)}>
        <Button
          variant="plain"
          size="sm"
          aria-label={t('Help for {{filter}}', { filter: t(label) })}
          icon={<HelpIcon />}
        />
      </Tooltip>
    </div>
  );
}
