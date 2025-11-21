import * as React from 'react';
import {
  consoleFetchJSON,
  GreenCheckCircleIcon,
  PrometheusAlert,
  Silence,
  SilenceStates,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import {
  Alert as PFAlert,
  Button,
  Checkbox,
  Label,
  DropdownItem,
  Dropdown,
  DropdownPosition,
  KebabToggle,
  ModalVariant,
  Modal,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import {
  labelsToParams,
  refreshSilences,
  silenceMatcherEqualitySymbol,
  SilenceResource,
  silenceState,
} from '../utils';
import classNames from 'classnames';
import { BanIcon, HourglassHalfIcon } from '@patternfly/react-icons';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import { useBoolean } from '../hooks/useBoolean';
import { usePerspective } from '../hooks/usePerspective';
import { useDispatch } from 'react-redux';
import { LoadingInline } from '../console/utils/status-box';
import { MonitoringResourceIcon, OnToggle, SeverityCounts, StateTimestamp } from './AlertUtils';

export const tableSilenceClasses = [
  'pf-c-table__action', // Checkbox
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Firing alerts
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Creator
  'dropdown-kebab-pf pf-c-table__action',
];

export const SilenceTableRow: React.FC<SilenceTableRowProps> = ({ obj, showCheckbox }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { isDev } = usePerspective();
  const [namespace] = useActiveNamespace();

  const { createdBy, endsAt, firingAlerts, id, name, startsAt } = obj;
  const state = silenceState(obj);

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
        <td className={tableSilenceClasses[0]}>
          <Checkbox
            id={id}
            isChecked={selectedSilences.has(id)}
            isDisabled={state === SilenceStates.Expired}
            onChange={onCheckboxChange}
          />
        </td>
      )}
      <td className={tableSilenceClasses[1]}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={SilenceResource} />
          <Link
            className="co-resource-item__resource-name"
            data-test-id="silence-resource-link"
            title={id}
            to={isDev ? devSilenceAlertURL(id, namespace) : silenceAlertURL(id)}
          >
            {name}
          </Link>
        </div>
        <div className="monitoring-label-list">
          <SilenceMatchersList silence={obj} />
        </div>
      </td>
      <td className={tableSilenceClasses[2]}>
        <SeverityCounts alerts={firingAlerts} />
      </td>
      <td className={classNames(tableSilenceClasses[3], 'co-break-word')}>
        <SilenceState silence={obj} />
        {state === SilenceStates.Pending && (
          <StateTimestamp text={t('Starts')} timestamp={startsAt} />
        )}
        {state === SilenceStates.Active && <StateTimestamp text={t('Ends')} timestamp={endsAt} />}
        {state === SilenceStates.Expired && (
          <StateTimestamp text={t('Expired')} timestamp={endsAt} />
        )}
      </td>
      <td className={tableSilenceClasses[4]}>{createdBy || '-'}</td>
      <td className={tableSilenceClasses[5]}>
        <SilenceDropdownKebab silence={obj} />
      </td>
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
  <div className={`co-text-${SilenceResource.kind.toLowerCase()}`}>
    {_.map(silence.matchers, ({ name, isEqual, isRegex, value }, i) => (
      <Label className="co-label" key={i}>
        <span className="co-label__key">{name}</span>
        <span className="co-label__eq">{silenceMatcherEqualitySymbol(isEqual, isRegex)}</span>
        <span className="co-label__value">{value}</span>
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
  const { t } = useTranslation('plugin__monitoring-plugin');

  const state = silenceState(silence);
  const icon = {
    [SilenceStates.Active]: <GreenCheckCircleIcon />,
    [SilenceStates.Pending]: <HourglassHalfIcon className="monitoring-state-icon--pending" />,
    [SilenceStates.Expired]: <BanIcon className="text-muted" data-test-id="ban-icon" />,
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

const SilenceDropdownKebab: React.FC<{ silence: Silence }> = ({ silence }) => (
  <SilenceDropdown isPlain silence={silence} Toggle={KebabToggle} />
);

const SilenceDropdown_: React.FC<SilenceDropdownProps> = ({
  className,
  history,
  isPlain,
  silence,
  Toggle,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { isDev } = usePerspective();
  const [namespace] = useActiveNamespace();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const editSilence = () => {
    history.push(
      isDev ? editDevSilenceAlertURL(silence.id, namespace) : editSilenceAlertURL(silence.id),
    );
  };

  const dropdownItems =
    silenceState(silence) === SilenceStates.Expired
      ? [
          <DropdownItem key="edit-silence" component="button" onClick={editSilence}>
            {t('Recreate silence')}
          </DropdownItem>,
        ]
      : [
          <DropdownItem key="edit-silence" component="button" onClick={editSilence}>
            {t('Edit silence')}
          </DropdownItem>,
          <DropdownItem key="cancel-silence" component="button" onClick={setModalOpen}>
            {t('Expire silence')}
          </DropdownItem>,
        ];

  return (
    <>
      <Dropdown
        className={className}
        data-test="silence-actions"
        dropdownItems={dropdownItems}
        isOpen={isOpen}
        isPlain={isPlain}
        onSelect={setClosed}
        position={DropdownPosition.right}
        toggle={<Toggle onToggle={setIsOpen} />}
      />
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
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective, isDev } = usePerspective();
  const [namespace] = useActiveNamespace();

  const dispatch = useDispatch();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);
  const [errorMessage, setErrorMessage] = React.useState();

  const expireSilence = () => {
    setInProgress();
    const url = isDev
      ? `api/alertmanager-tenancy/api/v2/silence/${silenceID}?namespace=${namespace}`
      : `${window.SERVER_FLAGS.alertManagerBaseURL}/api/v2/silence/${silenceID}`;
    consoleFetchJSON
      .delete(url)
      .then(() => {
        refreshSilences(dispatch, perspective);
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
              <PFAlert
                className="co-alert co-alert--scrollable"
                isInline
                title={t('An error occurred')}
                variant="danger"
              >
                <div className="co-pre-line">{errorMessage}</div>
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
  className?: string;
  isPlain?: boolean;
  silence: Silence;
  Toggle: React.FC<{ onToggle: OnToggle }>;
};

export const newSilenceAlertURL = (alert: PrometheusAlert) =>
  `${SilenceResource.plural}/~new?${labelsToParams(alert.labels)}`;

export const newDevSilenceAlertURL = (alert: PrometheusAlert, namespace: string) =>
  `/dev-monitoring/ns/${namespace}/silences/~new?${labelsToParams(alert.labels)}`;

export const silenceAlertURL = (id: string) => `${SilenceResource.plural}/${id}`;

export const devSilenceAlertURL = (id: string, namespace: string) =>
  `/dev-monitoring/ns/${namespace}/silences/${id}`;

export const editSilenceAlertURL = (id: string) => `${SilenceResource.plural}/${id}/edit`;

export const editDevSilenceAlertURL = (id: string, namespace: string) =>
  `/dev-monitoring/ns/${namespace}/silences/${id}/edit`;

export const fetchSilenceAlertURL = (
  isDev: boolean,
  alertManagerBaseURL: string,
  namespace: string,
) => {
  if (isDev) {
    return `api/alertmanager-tenancy/api/v2/silences?namespace=${namespace}`;
  }
  if (alertManagerBaseURL) {
    return `${alertManagerBaseURL}/api/v2/silences`;
  }
  return '';
};
