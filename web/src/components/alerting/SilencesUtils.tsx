import * as React from 'react';
import {
  consoleFetchJSON,
  GreenCheckCircleIcon,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import {
  Alert as PFAlert,
  Button,
  Checkbox,
  Label,
  ModalVariant,
  Modal,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import {
  Dropdown as DropdownDeprecated,
  DropdownItem as DropdownItemDeprecated,
  DropdownPosition as DropdownPositionDeprecated,
  KebabToggle as KebabToggleDeprecated,
} from '@patternfly/react-core/deprecated';
import {
  refreshSilences,
  silenceMatcherEqualitySymbol,
  SilenceResource,
  silenceState,
} from '../utils';
import classNames from 'classnames';
import { BanIcon, HourglassHalfIcon } from '@patternfly/react-icons';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import { useBoolean } from '../hooks/useBoolean';
import {
  getEditSilenceAlertUrl,
  getSilenceAlertUrl,
  getFetchSilenceUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { useDispatch } from 'react-redux';
import { LoadingInline } from '../console/utils/status-box';
import { MonitoringResourceIcon, OnToggle, SeverityCounts, StateTimestamp } from './AlertUtils';
import { useActiveNamespace } from '../console/console-shared/hooks/useActiveNamespace';

export const tableSilenceClasses = [
  'pf-c-table__action', // Checkbox
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Firing alerts
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Creator
  'pf-m-hidden pf-m-visible-on-sm', // Cluster
  'dropdown-kebab-pf pf-c-table__action',
];

export const SilenceTableRow: React.FC<SilenceTableRowProps> = ({ obj, showCheckbox }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const namespace = useActiveNamespace();

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
        <td className={tableSilenceClasses[0]}>
          <Checkbox
            id={id}
            isChecked={selectedSilences.has(id)}
            isDisabled={state === SilenceStates.Expired}
            onChange={(_e, checked) => {
              typeof _e === 'boolean' ? onCheckboxChange(checked) : onCheckboxChange(checked);
            }}
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
            to={getSilenceAlertUrl(perspective, id, namespace)}
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
      {perspective === 'acm' && <td className={tableSilenceClasses[5]}>{cluster}</td>}
      <td className={tableSilenceClasses[6]}>
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
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

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
  <SilenceDropdown
    isPlain
    silence={silence}
    Toggle={({ onToggle, ...props }: { onToggle: OnToggle }) => (
      <KebabToggleDeprecated
        aria-label="Actions"
        onToggle={(e, v) => onToggle(v, e as MouseEvent)}
        {...props}
      />
    )}
  />
);

const SilenceDropdown_: React.FC<SilenceDropdownProps> = ({
  className,
  history,
  isPlain,
  silence,
  Toggle,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const namespace = useActiveNamespace();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const editSilence = () => {
    history.push(getEditSilenceAlertUrl(perspective, silence.id, namespace));
  };

  const dropdownItems =
    silenceState(silence) === SilenceStates.Expired
      ? [
          <DropdownItemDeprecated key="edit-silence" component="button" onClick={editSilence}>
            {t('Recreate silence')}
          </DropdownItemDeprecated>,
        ]
      : [
          <DropdownItemDeprecated key="edit-silence" component="button" onClick={editSilence}>
            {t('Edit silence')}
          </DropdownItemDeprecated>,
          <DropdownItemDeprecated key="cancel-silence" component="button" onClick={setModalOpen}>
            {t('Expire silence')}
          </DropdownItemDeprecated>,
        ];

  return (
    <>
      <DropdownDeprecated
        className={className}
        data-test="silence-actions"
        dropdownItems={dropdownItems}
        isOpen={isOpen}
        isPlain={isPlain}
        onSelect={setClosed}
        position={DropdownPositionDeprecated.right}
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
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective, silencesKey } = usePerspective();
  const namespace = useActiveNamespace();

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
