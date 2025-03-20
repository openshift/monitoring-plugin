import {
  consoleFetchJSON,
  GreenCheckCircleIcon,
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
  MenuToggle,
  MenuToggleElement,
  Panel,
  PanelMain,
  PanelMainBody,
  Alert as PFAlert,
} from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { BanIcon, EllipsisVIcon, HourglassHalfIcon } from '@patternfly/react-icons';
import classNames from 'classnames';
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
import { MonitoringResourceIcon, SeverityCounts, StateTimestamp } from './AlertUtils';
import { LoadingInline } from '../console/console-shared/src/components/loading/LoadingInline';
import { Td } from '@patternfly/react-table';

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
        <Td>
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
      <Td>
        <Flex spaceItems={{ default: 'spaceItemsNone' }} flexWrap={{ default: 'nowrap' }}>
          <FlexItem>
            <MonitoringResourceIcon resource={SilenceResource} />
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
        <div>
          <SilenceMatchersList silence={obj} />
        </div>
      </Td>
      <Td>
        <SeverityCounts alerts={firingAlerts} />
      </Td>
      <Td>
        <SilenceState silence={obj} />
        {state === SilenceStates.Pending && (
          <StateTimestamp text={t('Starts')} timestamp={startsAt} />
        )}
        {state === SilenceStates.Active && <StateTimestamp text={t('Ends')} timestamp={endsAt} />}
        {state === SilenceStates.Expired && (
          <StateTimestamp text={t('Expired')} timestamp={endsAt} />
        )}
      </Td>
      <Td>{createdBy || '-'}</Td>
      {perspective === 'acm' && <Td>{cluster}</Td>}
      <Td>
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
  <div>
    {_.map(silence.matchers, ({ name, isEqual, isRegex, value }, i) => (
      <Label key={i}>
        <span>{name}</span>
        <span>{silenceMatcherEqualitySymbol(isEqual, isRegex)}</span>
        <span>{value}</span>
      </Label>
    ))}
  </div>
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

const ExpireSilenceModal: React.FC<ExpireSilenceModalProps> = ({
  isOpen,
  setClosed,
  silenceID,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective, silencesKey } = usePerspective();
  const [namespace] = useActiveNamespace();

  const dispatch = useDispatch();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);
  const [errorMessage, setErrorMessage] = React.useState();

  const expireSilence = () => {
    setInProgress();
    const url = getFetchSilenceUrl(perspective, silenceID, namespace);
    consoleFetchJSON
      .delete(url)
      .then(() => {
        refreshSilences(dispatch, perspective, silencesKey);
        setClosed();
      })
      .catch((err) => {
        setErrorMessage(_.get(err, 'json.error') || err.message || 'Error expiring silence');
        setNotInProgress();
      })
      .then(setNotInProgress);
  };

  return (
    <Modal
      isOpen={isOpen}
      position="top"
      showClose={false}
      title={t('Expire silence')}
      variant={ModalVariant.small}
    >
      <Flex direction={{ default: 'column' }}>
        <FlexItem>{t('Are you sure you want to expire this silence?')}</FlexItem>
        <Flex direction={{ default: 'column' }}>
          <FlexItem>
            {errorMessage && (
              <PFAlert isInline title={t('An error occurred')} variant="danger">
                <Panel isScrollable>
                  <PanelMain maxHeight="100px">
                    <PanelMainBody>{errorMessage}</PanelMainBody>
                  </PanelMain>
                </Panel>
              </PFAlert>
            )}
          </FlexItem>
          <Flex>
            <FlexItem>{isInProgress && <LoadingInline />}</FlexItem>
            <FlexItem align={{ default: 'alignRight' }}>
              <Button variant="secondary" onClick={setClosed}>
                {t('Cancel')}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" onClick={expireSilence}>
                {t('Expire silence')}
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};

type SilenceDropdownProps = RouteComponentProps & {
  silence: Silence;
  toggleText?: string;
};
