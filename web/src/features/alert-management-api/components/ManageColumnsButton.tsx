import { Button, Tooltip } from '@patternfly/react-core';
import { ColumnsIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

export function ManageColumnsButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return (
    <Tooltip content={t('Manage columns')}>
      <Button
        variant="control"
        icon={<ColumnsIcon />}
        aria-label={t('Manage columns')}
        onClick={onClick}
      />
    </Tooltip>
  );
}
