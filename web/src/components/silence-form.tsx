import * as _ from 'lodash-es';
import {
  consoleFetchJSON,
  Silence,
  SilenceStates,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionGroup,
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  Divider,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  PageGroup,
  PageSection,
  PageSectionVariants,
  Select,
  SelectList,
  SelectOption,
  Text,
  TextArea,
  TextContent,
  TextInput,
  TextVariants,
  Timestamp,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { MinusCircleIcon, PlusCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';

// TODO: These will be available in future versions of the plugin SDK
const getUser = (state) => state.sdkCore?.user;

import { ButtonBar } from './console/utils/button-bar';
import { ExternalLink } from './console/utils/link';
import { getAllQueryArguments } from './console/utils/router';

import { useBoolean } from './hooks/useBoolean';
import { Silences } from './types';
import { refreshSilences, SilenceResource, silenceState } from './utils';
import {
  getFetchSilenceAlertUrl,
  getLegacyObserveState,
  getSilenceAlertUrl,
  usePerspective,
} from './hooks/usePerspective';
import { MonitoringState } from '../reducers/observe';
import { StatusBox } from './console/console-shared/src/components/status/StatusBox';
import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from './console/console-shared/src/datetime/prometheus';
import withFallback from './console/console-shared/error/fallbacks/withFallback';

const pad = (i: number): string => (i < 10 ? `0${i}` : String(i));

const formatDate = (d: Date): string =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;

const DatetimeTextInput = (props) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const pattern =
    '\\d{4}/(0?[1-9]|1[012])/(0?[1-9]|[12]\\d|3[01]) (0?\\d|1\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?';
  const isValid = new RegExp(`^${pattern}$`).test(props.value);

  return (
    <div>
      <Tooltip
        content={
          <Timestamp date={new Date(props.value)}>
            {isValid ? new Date(props.value).toISOString() : t('Invalid date / time')}
          </Timestamp>
        }
      >
        <TextInput
          {...props}
          aria-label={t('Datetime')}
          data-test-id="silence-datetime"
          validated={isValid || !!props.isDisabled ? 'default' : 'error'}
          pattern={pattern}
          placeholder="YYYY/MM/DD hh:mm:ss"
        />
      </Tooltip>
    </div>
  );
};

const NegativeMatcherHelp = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <DescriptionList>
      <DescriptionListDescription className="pf-v5-u-text-align-center">
        {t('Select the negative matcher option to update the label value to a not equals matcher.')}
      </DescriptionListDescription>
      <DescriptionListDescription className="pf-v5-u-text-align-center">
        {t(
          'If both the RegEx and negative matcher options are selected, the label value must not match the regular expression.',
        )}
      </DescriptionListDescription>
    </DescriptionList>
  );
};

type SilenceFormProps = RouteComponentProps & {
  defaults: any;
  Info?: React.ComponentType;
  title: string;
};

const SilenceForm_: React.FC<SilenceFormProps> = ({ defaults, history, Info, title }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const durationOff = '-';
  const durations = {
    [durationOff]: durationOff,
    '30m': t('30m'),
    '1h': t('1h'),
    '2h': t('2h'),
    '6h': t('6h'),
    '12h': t('12h'),
    '1d': t('1d'),
    '2d': t('2d'),
    '1w': t('1w'),
  };

  const now = new Date();

  // Default to starting now if we have no default start time or if the default start time is in the
  // past (because Alertmanager will change a time in the past to the current time on save anyway)
  const defaultIsStartNow = _.isEmpty(defaults.startsAt) || new Date(defaults.startsAt) < now;

  let defaultDuration = _.isEmpty(defaults.endsAt) ? '2h' : durationOff;

  // If we have both a default start and end time and the difference between them exactly matches
  // one of the duration options, automatically select that option in the duration menu
  if (!defaultIsStartNow && defaults.startsAt && defaults.endsAt) {
    const durationFromDefaults = formatPrometheusDuration(
      Date.parse(defaults.endsAt) - Date.parse(defaults.startsAt),
    );
    if (Object.keys(durations).includes(durationFromDefaults)) {
      defaultDuration = durationFromDefaults;
    }
  }

  const dispatch = useDispatch();

  const { perspective, silencesKey } = usePerspective();

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);

  const [comment, setComment] = React.useState(defaults.comment ?? '');
  const [createdBy, setCreatedBy] = React.useState(defaults.createdBy ?? '');
  const [duration, setDuration] = React.useState(defaultDuration);
  const [endsAt, setEndsAt] = React.useState(
    defaults.endsAt ?? formatDate(new Date(new Date(now).setHours(now.getHours() + 2))),
  );
  const [error, setError] = React.useState<string>();
  const [inProgress, setInProgress] = React.useState(false);
  const [isStartNow, setIsStartNow] = React.useState(defaultIsStartNow);
  const [matchers, setMatchers] = React.useState(
    defaults.matchers ?? [{ isRegex: false, name: '', value: '' }],
  );
  const [startsAt, setStartsAt] = React.useState(defaults.startsAt ?? formatDate(now));
  const user = useSelector(getUser);
  const [namespace] = useActiveNamespace();

  React.useEffect(() => {
    if (!createdBy && user) {
      setCreatedBy(user.metadata?.name || user.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const getEndsAtValue = (): string => {
    const startsAtDate = Date.parse(startsAt);
    return startsAtDate
      ? formatDate(new Date(startsAtDate + parsePrometheusDuration(duration)))
      : '-';
  };

  const setMatcherField = (i: number, field: string, v: any): void => {
    const newMatchers = _.clone(matchers);
    _.set(newMatchers, [i, field], v);
    setMatchers(newMatchers);
  };

  const addMatcher = (): void => {
    setMatchers([...matchers, { isRegex: false, name: '', value: '' }]);
  };

  const removeMatcher = (i: number): void => {
    const newMatchers = _.clone(matchers);
    newMatchers.splice(i, 1);

    // If all matchers have been removed, add back a single blank matcher
    setMatchers(_.isEmpty(newMatchers) ? [{ isRegex: false, name: '', value: '' }] : newMatchers);
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    // Don't allow comments to only contain whitespace
    if (_.trim(comment) === '') {
      setError('Comment is required.');
      return;
    }

    const url = getFetchSilenceAlertUrl(perspective, namespace);
    if (!url) {
      setError('Alertmanager URL not set');
      return;
    }

    setInProgress(true);

    const saveStartsAt: Date = isStartNow ? new Date() : new Date(startsAt);
    const saveEndsAt: Date =
      duration === durationOff
        ? new Date(endsAt)
        : new Date(saveStartsAt.getTime() + parsePrometheusDuration(duration));

    const body = {
      comment,
      createdBy,
      endsAt: saveEndsAt.toISOString(),
      id: defaults.id,
      matchers,
      startsAt: saveStartsAt.toISOString(),
    };

    consoleFetchJSON
      .post(getFetchSilenceAlertUrl(perspective, namespace), body)
      .then(({ silenceID }) => {
        setError(undefined);
        refreshSilences(dispatch, perspective, silencesKey, namespace);
        history.push(getSilenceAlertUrl(perspective, silenceID, namespace));
      })
      .catch((err) => {
        const errorMessage =
          typeof _.get(err, 'json') === 'string'
            ? _.get(err, 'json')
            : err.message || 'Error saving Silence';
        setError(errorMessage);
        setInProgress(false);
      });
  };

  const selectOptions = _.map(durations, (displayText, key) => (
    <SelectOption key={key} value={key}>
      {displayText}
    </SelectOption>
  ));

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <PageSection variant={PageSectionVariants.light}>
        <Title headingLevel="h1">{title}</Title>
        <HelperText>
          <HelperTextItem className="monitoring__title-help-text">
            {t(
              'Silences temporarily mute alerts based on a set of label selectors that you define. Notifications will not be sent for alerts that match all the listed values or regular expressions.',
            )}
          </HelperTextItem>
        </HelperText>
      </PageSection>
      <Divider />

      <PageGroup>
        {Info && <Info />}
        <form onSubmit={onSubmit} className="monitoring-silence-alert">
          <PageSection variant={PageSectionVariants.light}>
            <Title headingLevel="h2">{t('Duration')}</Title>
            <div className="row">
              <div className="form-group col-sm-4 col-md-5">
                <label>{t('Silence alert from...')}</label>
                {isStartNow ? (
                  <DatetimeTextInput isDisabled data-test="silence-from" value={t('Now')} />
                ) : (
                  <DatetimeTextInput
                    data-test="silence-from"
                    isRequired
                    onChange={(_event, value: string) => setStartsAt(value)}
                    value={startsAt}
                  />
                )}
              </div>
              <div className="form-group col-sm-4 col-md-2">
                <label>{t('For...')}</label>
                <Select
                  data-test="silence-for"
                  isOpen={isOpen}
                  onSelect={(event: React.MouseEvent | React.ChangeEvent, value: string) => {
                    setDuration(value);
                    setClosed();
                  }}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={setIsOpen}
                      isExpanded={isOpen}
                      isFullWidth
                      data-test="silence-for-toggle"
                    >
                      {duration}
                    </MenuToggle>
                  )}
                  onOpenChange={setIsOpen}
                >
                  <SelectList>{selectOptions}</SelectList>
                </Select>
              </div>
              <div className="form-group col-sm-4 col-md-5">
                <label>{t('Until...')}</label>
                {duration === durationOff ? (
                  <DatetimeTextInput
                    data-test="silence-until"
                    isRequired
                    onChange={(_event, value: string) => setEndsAt(value)}
                    value={endsAt}
                  />
                ) : (
                  <DatetimeTextInput
                    data-test="silence-until"
                    isDisabled
                    value={
                      isStartNow
                        ? t('{{duration}} from now', { duration: durations[duration] })
                        : getEndsAtValue()
                    }
                  />
                )}
              </div>
            </div>
            <div className="form-group">
              <label>
                <input
                  data-test="silence-start-immediately"
                  checked={isStartNow}
                  onChange={(e) => setIsStartNow(e.currentTarget.checked)}
                  type="checkbox"
                />
                &nbsp; {t('Start immediately')}
              </label>
            </div>
          </PageSection>

          <PageSection variant={PageSectionVariants.light}>
            <Title headingLevel="h2">{t('Alert labels')}</Title>
            <TextContent>
              <Text component={TextVariants.small}>
                <Trans t={t}>
                  Alerts with labels that match these selectors will be silenced instead of firing.
                  Label values can be matched exactly or with a{' '}
                  <ExternalLink
                    href="https://github.com/google/re2/wiki/Syntax"
                    text={t('regular expression')}
                  />
                </Trans>
              </Text>
            </TextContent>

            {_.map(matchers, (matcher, i: number) => (
              <div className="row" key={i}>
                <div className="form-group col-sm-4">
                  <label>{t('Label name')}</label>
                  <TextInput
                    aria-label={t('Label name')}
                    isRequired
                    onChange={(_e, v: string) =>
                      typeof _e === 'string'
                        ? setMatcherField(i, 'name', _e)
                        : setMatcherField(i, 'name', v)
                    }
                    placeholder={t('Name')}
                    value={matcher.name}
                  />
                </div>
                <div className="form-group col-sm-4">
                  <label>{t('Label value')}</label>
                  <TextInput
                    aria-label={t('Label value')}
                    isRequired
                    onChange={(_e, v: string) =>
                      typeof _e === 'string'
                        ? setMatcherField(i, 'value', _e)
                        : setMatcherField(i, 'value', v)
                    }
                    placeholder={t('Value')}
                    value={matcher.value}
                  />
                </div>
                <div className="form-group col-sm-4">
                  <div className="monitoring-silence-alert__label-options">
                    <label>
                      <input
                        checked={matcher.isRegex}
                        onChange={(e) => setMatcherField(i, 'isRegex', e.currentTarget.checked)}
                        type="checkbox"
                      />
                      &nbsp; {t('RegEx')}
                    </label>
                    <Tooltip content={<NegativeMatcherHelp />}>
                      <label>
                        <input
                          checked={matcher.isEqual === false}
                          onChange={(e) => setMatcherField(i, 'isEqual', !e.currentTarget.checked)}
                          type="checkbox"
                        />
                        &nbsp; {t('Negative matcher')}
                      </label>
                    </Tooltip>
                    <Tooltip content={t('Remove')}>
                      <Button
                        type="button"
                        onClick={() => removeMatcher(i)}
                        aria-label={t('Remove')}
                        variant="plain"
                      >
                        <MinusCircleIcon />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}

            <div className="form-group">
              <Button
                className="pf-v5-m-link--align-left"
                onClick={addMatcher}
                type="button"
                variant="link"
              >
                <PlusCircleIcon className="co-icon-space-r" />
                {t('Add label')}
              </Button>
            </div>
          </PageSection>

          <PageSection variant={PageSectionVariants.light}>
            <Title headingLevel="h2">{t('Info')}</Title>
            <div className="form-group">
              <label className="co-required">{t('Creator')}</label>
              <TextInput
                aria-label={t('Creator')}
                isRequired
                onChange={(_e, v: string) =>
                  typeof _e === 'string' ? setCreatedBy(_e) : setCreatedBy(v)
                }
                value={createdBy}
              />
            </div>
            <div className="form-group">
              <label className="co-required">{t('Comment')}</label>
              <TextArea
                aria-label={t('Comment')}
                isRequired
                onChange={(_e, v: string) =>
                  typeof _e === 'string' ? setComment(_e) : setComment(v)
                }
                data-test="silence-comment"
                value={comment}
              />
            </div>
            <ButtonBar errorMessage={error} inProgress={inProgress}>
              <ActionGroup className="pf-v5-c-form">
                <Button type="submit" variant="primary">
                  {t('Silence')}
                </Button>
                <Button onClick={history.goBack} variant="secondary">
                  {t('Cancel')}
                </Button>
              </ActionGroup>
            </ButtonBar>
          </PageSection>
        </form>
      </PageGroup>
    </>
  );
};
const SilenceForm = withFallback(withRouter(SilenceForm_));

const EditInfo = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Alert isInline title={t('Overwriting current silence')} variant="info">
      {t(
        'When changes are saved, the currently existing silence will be expired and a new silence with the new configuration will take its place.',
      )}
    </Alert>
  );
};

export const EditSilence = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { silencesKey, perspective } = usePerspective();

  const silences: Silences = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(silencesKey),
  );

  const silence: Silence = _.find(silences?.data, { id: match.params.id });
  const isExpired = silenceState(silence) === SilenceStates.Expired;
  const defaults = _.pick(silence, [
    'comment',
    'createdBy',
    'endsAt',
    'id',
    'matchers',
    'startsAt',
  ]);
  defaults.startsAt = isExpired ? undefined : formatDate(new Date(defaults.startsAt));
  defaults.endsAt = isExpired ? undefined : formatDate(new Date(defaults.endsAt));

  return (
    <StatusBox
      data={silence}
      label={SilenceResource.label}
      loaded={silences?.loaded}
      loadError={silences?.loadError}
    >
      <SilenceForm
        defaults={defaults}
        Info={isExpired ? undefined : EditInfo}
        title={isExpired ? t('Recreate silence') : t('Edit silence')}
      />
    </StatusBox>
  );
};

export const CreateSilence = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const matchers = _.map(getAllQueryArguments(), (value, name) => ({
    name,
    value,
    isRegex: false,
  }));

  return _.isEmpty(matchers) ? (
    <SilenceForm defaults={{}} title={t('Create silence')} />
  ) : (
    <SilenceForm defaults={{ matchers }} title={t('Silence alert')} />
  );
};
