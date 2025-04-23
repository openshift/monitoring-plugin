import {
  consoleFetchJSON,
  GreenCheckCircleIcon,
  ResourceIcon,
  Silence,
  SilenceStates,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
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
  Stack,
  StackItem,
} from '@patternfly/react-core';
import {
  BanIcon,
  CheckCircleIcon,
  EllipsisVIcon,
  HourglassHalfIcon,
} from '@patternfly/react-icons';
import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import { useBoolean } from '../hooks/useBoolean';
import {
  getEditSilenceAlertUrl,
  getFetchSilenceUrl,
  getSilenceAlertUrl,
  usePerspective,
} from '../hooks/usePerspective';
import {
  refreshSilences,
  silenceMatcherEqualitySymbol,
  SilenceResource,
  silenceState,
} from '../utils';
import { SeverityCounts, StateTimestamp } from './AlertUtils';
import { Td } from '@patternfly/react-table';
import { t_global_spacer_xs } from '@patternfly/react-tokens';

export const SilenceTableRow: React.FC<SilenceTableRowProps> = ({ obj, showCheckbox }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();

  const { createdBy, endsAt, firingAlerts, id, name, startsAt, matchers } = obj;
  const state = silenceState(obj);
  const cluster = matchers.find((label) => label.name === 'cluster')?.value;

  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const onCheckboxChange = React.useCallback(
    (isChecked: boolean) => {
      setSelectedSilences((oldSet) => {
        const newSet = new Set(oldSet);
        if (isChecked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
    },
    [id, setSelectedSilences],
  );

  return (
    <>
      {showCheckbox && (
        <Td width={10}>
          <Checkbox
            id={id}
            isChecked={selectedSilences.has(id)}
            isDisabled={state === SilenceStates.Expired}
            onChange={(_e, checked) => {
              typeof _e === 'boolean' ? onCheckboxChange(checked) : onCheckboxChange(checked);
            }}
          />
        </Td>
      )}
      <Td width={40}>
        <Flex
          spaceItems={{ default: 'spaceItemsNone' }}
          flexWrap={{ default: 'nowrap' }}
          style={{ paddingBottom: t_global_spacer_xs.var }}
        >
          <FlexItem>
            <ResourceIcon kind={SilenceResource.kind} />
          </FlexItem>
          <FlexItem>
            <Link
              data-test-id="silence-resource-link"
              title={id}
              to={getSilenceAlertUrl(perspective, id, namespace)}
            >
              {name}
            </Link>
          </FlexItem>
        </Flex>
        <SilenceMatchersList silence={obj} />
      </Td>
      <Td width={15}>
        <SeverityCounts alerts={firingAlerts} />
      </Td>
      <Td width={20}>
        <Stack>
          <StackItem>
            <SilenceState silence={obj} />
          </StackItem>
          <StackItem>
            {state === SilenceStates.Pending && (
              <StateTimestamp text={t('Starts')} timestamp={startsAt} />
            )}
            {state === SilenceStates.Active && (
              <StateTimestamp text={t('Ends')} timestamp={endsAt} />
            )}
            {state === SilenceStates.Expired && (
              <StateTimestamp text={t('Expired')} timestamp={endsAt} />
            )}
          </StackItem>
        </Stack>
      </Td>
      <Td width={15}>{createdBy || '-'}</Td>
      {perspective === 'acm' && <Td width={15}>{cluster}</Td>}
      <Td width={10}>
        <SilenceDropdown silence={obj} />
      </Td>
    </>
  );
};

type SilenceTableRowProps = {
  obj: Silence;
  showCheckbox?: boolean;
};

export const SelectedSilencesContext = React.createContext({
  selectedSilences: new Set(),
  setSelectedSilences: undefined,
});

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

export type ExpireSilenceModalProps = {
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

const SilenceDropdown_: React.FC<SilenceDropdownProps> = ({ history, silence, toggleText }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const editSilence = () => {
    history.push(getEditSilenceAlertUrl(perspective, silence.id, namespace));
  };

  const dropdownItems =
    silenceState(silence) === SilenceStates.Expired
      ? [
          <DropdownItem value={0} key="recreate-silence" onClick={editSilence}>
            {t('Recreate silence')}
          </DropdownItem>,
        ]
      : [
          <DropdownItem value={0} key="edit-silence" onClick={editSilence}>
            {t('Edit silence')}
          </DropdownItem>,
          <DropdownItem value={1} key="cancel-silence" onClick={setModalOpen}>
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
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            aria-label="kebab dropdown toggle"
            variant={toggleText ? 'default' : 'plain'}
            onClick={setIsOpen}
            isExpanded={isOpen}
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
export const SilenceDropdown = withRouter(SilenceDropdown_);

export const ExpireSilenceModal: React.FC<ExpireSilenceModalProps> = ({
  isOpen,
  setClosed,
  silenceID,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective, silencesKey } = usePerspective();
  const [namespace] = useActiveNamespace();

  const dispatch = useDispatch();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);
  const [success, , setSuccess] = useBoolean(false);
  const [errorMessage, setErrorMessage] = React.useState();

  const expireSilence = () => {
    setInProgress();
    const url = getFetchSilenceUrl(perspective, silenceID, namespace);
    consoleFetchJSON
      .delete(url)
      .then(() => {
        setNotInProgress();
        setSuccess();
        setTimeout(() => {
          refreshSilences(dispatch, perspective, silencesKey);
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
        >
          {success ? t('Expired') : t('Expire silence')}
        </Button>
        <Button variant="secondary" onClick={setClosed}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

type SilenceDropdownProps = RouteComponentProps & {
  silence: Silence;
  toggleText?: string;
};
