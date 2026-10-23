import { Alert, AlertActionCloseButton, AlertGroup } from '@patternfly/react-core';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { AIExperienceIcon } from '@/features/troubleshooting/components/AIExperienceIcon';
import { setAgentToast } from '@/features/troubleshooting/store/actions';
import { State } from '@/features/troubleshooting/store/reducers';

const DISMISS_MS = 8000;

// Above the console's modal backdrop (~1050) so the toast is never hidden.
const TOAST_ZINDEX = 1060;

const AgentToast = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const toastMessage: string = useSelector((s: State) => s.plugins?.tp?.get('agentToast'));
  const dismiss = useCallback(() => dispatch(setAgentToast('')), [dispatch]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(dismiss, DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, dismiss]);

  if (!toastMessage) return null;

  return (
    <AlertGroup isToast isLiveRegion style={{ zIndex: TOAST_ZINDEX }}>
      <Alert
        variant="info"
        title={t('AI agent updating your view')}
        customIcon={<AIExperienceIcon />}
        actionClose={<AlertActionCloseButton onClose={dismiss} />}
      >
        {toastMessage}
      </Alert>
    </AlertGroup>
  );
};

export default AgentToast;
