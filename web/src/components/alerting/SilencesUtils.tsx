import {
  consoleFetchJSON,
  GreenCheckCircleIcon,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  LabelGroup,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Panel,
  PanelMain,
  PanelMainBody,
  Alert as PFAlert,
} from '@patternfly/react-core';
import {
  BanIcon,
  CheckCircleIcon,
  EllipsisVIcon,
  HourglassHalfIcon,
} from '@patternfly/react-icons';
import * as _ from 'lodash-es';
import type { FC, Ref } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useBoolean } from '../hooks/useBoolean';
import {
  getEditSilenceAlertUrl,
  getFetchSilenceUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { useMonitoringNamespace } from '../hooks/useMonitoringNamespace';
import { silenceMatcherEqualitySymbol, silenceState } from '../utils';
import { DataTestIDs } from '../data-test';

export const SilenceMatchersList = ({ silence }) => (
  <LabelGroup numLabels={20}>
    {_.map(silence.matchers, ({ name, isEqual, isRegex, value }, i) => (
      <Label key={i}>
        <span>{name}</span>
        <span>{silenceMatcherEqualitySymbol(isEqual, isRegex)}</span>
        <span>{value}</span>
      </Label>
    ))}
  </LabelGroup>
);

type ExpireSilenceModalProps = {
  isOpen: boolean;
  setClosed: () => void;
  silenceID: string;
};

export const SilenceState = ({ silence }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const state = silenceState(silence);
  const icon = {
    [SilenceStates.Active]: <GreenCheckCircleIcon />,
    [SilenceStates.Pending]: <HourglassHalfIcon />,
    [SilenceStates.Expired]: <BanIcon data-test-id="ban-icon" />,
  }[state];

  const getStateKey = (stateData) => {
    switch (stateData) {
      case SilenceStates.Active:
        return t('Active');
      case SilenceStates.Pending:
        return t('Pending');
      default:
        return t('Expired');
    }
  };

  return icon ? (
    <>
      {icon} {getStateKey(state)}
    </>
  ) : null;
};

export const SilenceDropdown: FC<SilenceDropdownProps> = ({ silence, toggleText }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  const { namespace } = useMonitoringNamespace();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const editSilence = () => {
    navigate(getEditSilenceAlertUrl(perspective, silence.id, namespace));
  };

  const dropdownItems =
    silenceState(silence) === SilenceStates.Expired
      ? [
          <DropdownItem
            data-test={DataTestIDs.SilenceRecreateDropdownItem}
            value={0}
            key="recreate-silence"
            onClick={editSilence}
          >
            {t('Recreate silence')}
          </DropdownItem>,
        ]
      : [
          <DropdownItem
            data-test={DataTestIDs.SilenceEditDropdownItem}
            value={0}
            key="edit-silence"
            onClick={editSilence}
          >
            {t('Edit silence')}
          </DropdownItem>,
          <DropdownItem
            data-test={DataTestIDs.SilenceExpireDropdownItem}
            value={1}
            key="cancel-silence"
            onClick={setModalOpen}
          >
            {t('Expire silence')}
          </DropdownItem>,
        ];

  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onSelect={setClosed}
        data-test="silence-actions"
        popperProps={{ position: 'right' }}
        onOpenChange={(isOpen: boolean) => (isOpen ? setIsOpen() : setClosed())}
        toggle={(toggleRef: Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            aria-label="kebab dropdown toggle"
            variant={toggleText ? 'default' : 'plain'}
            onClick={setIsOpen}
            isExpanded={isOpen}
            data-test={DataTestIDs.KebabDropdownButton}
          >
            {toggleText || <EllipsisVIcon />}
          </MenuToggle>
        )}
      >
        <DropdownList>{dropdownItems}</DropdownList>
      </Dropdown>
      <ExpireSilenceModal isOpen={isModalOpen} setClosed={setModalClosed} silenceID={silence.id} />
    </>
  );
};

export const ExpireSilenceModal: FC<ExpireSilenceModalProps> = ({
  isOpen,
  setClosed,
  silenceID,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);
  const [success, , setSuccess] = useBoolean(false);
  const [errorMessage, setErrorMessage] = useState();

  const expireSilence = () => {
    setInProgress();
    const url = getFetchSilenceUrl(perspective, silenceID, namespace);
    consoleFetchJSON
      .delete(url)
      .then(() => {
        setNotInProgress();
        setSuccess();
        setTimeout(() => {
          setClosed();
        }, 1000);
      })
      .catch((err) => {
        setErrorMessage(_.get(err, 'json.error') || err.message || 'Error expiring silence');
        setNotInProgress();
      });
  };

  return (
    <Modal isOpen={isOpen} position="top" title={t('Expire silence')} variant={ModalVariant.small}>
      <ModalHeader title={t('Expire Silence')} />
      <ModalBody>
        {t('Are you sure you want to expire this silence?')}
        {errorMessage && (
          <PFAlert isInline title={t('An error occurred')} variant="danger">
            <Panel isScrollable>
              <PanelMain maxHeight="100px">
                <PanelMainBody>{errorMessage}</PanelMainBody>
              </PanelMain>
            </Panel>
          </PFAlert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={expireSilence}
          isLoading={isInProgress}
          icon={success ? <CheckCircleIcon /> : null}
          data-test={DataTestIDs.ExpireSilenceButton}
        >
          {success ? t('Expired') : t('Expire silence')}
        </Button>
        <Button variant="secondary" onClick={setClosed} data-test={DataTestIDs.CancelButton}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

type SilenceDropdownProps = {
  silence: Silence;
  toggleText?: string;
};
