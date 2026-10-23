import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Icon,
  Label,
  MenuToggle,
  MenuToggleElement,
  Switch,
  Tooltip,
} from '@patternfly/react-core';
import { Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { AIExperienceIcon } from '@/features/troubleshooting/components/AIExperienceIcon';
import { HelpPopover } from '@/features/troubleshooting/components/HelpPopover';
import {
  setAgentConnected,
  setAgentEnabled,
  setAgentError,
} from '@/features/troubleshooting/store/actions';
import { State } from '@/features/troubleshooting/store/reducers';

const AgentMenu = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);

  const agentConnected: boolean = useSelector((s: State) => s.plugins?.tp?.get('agentConnected'));
  const agentEnabled: boolean = useSelector((s: State) => s.plugins?.tp?.get('agentEnabled'));
  const agentError: string = useSelector((s: State) => s.plugins?.tp?.get('agentError'));

  const status = agentError
    ? 'danger'
    : agentConnected
      ? 'success'
      : agentEnabled
        ? 'warning'
        : undefined;

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: 'end' }}
      toggle={(toggleRef: Ref<MenuToggleElement>) => (
        <MenuToggle
          status={status}
          ref={toggleRef}
          variant="plain"
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
          aria-label={t('AI Agent settings')}
        >
          <Icon status={status}>
            <AIExperienceIcon />
          </Icon>
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem key="header">
          <Switch
            id="agent-enabled"
            isChecked={agentEnabled}
            hasCheckIcon
            label={t('Agent Navigation')}
            onChange={(_event, checked: boolean) => {
              dispatch(setAgentError(''));
              dispatch(setAgentConnected(false));
              dispatch(setAgentEnabled(checked));
            }}
          />
          <HelpPopover>
            {t(
              'Allow an AI agent with your user-id to connect with this console and use it to show you relevant views and correlation searches.',
            )}
          </HelpPopover>
        </DropdownItem>
        {status && (
          <DropdownItem>
            {status === 'danger' ? (
              <Tooltip content={String(agentError)}>
                <Label status={status}>{t('Unable to connect')}</Label>
              </Tooltip>
            ) : (
              <Label status={status}>
                {status === 'success' ? t('Connected') : t('Connecting')}
              </Label>
            )}
          </DropdownItem>
        )}
      </DropdownList>
    </Dropdown>
  );
};

export default AgentMenu;
