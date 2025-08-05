import { consoleFetchJSON, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionGroup,
  Alert,
  Button,
  Checkbox,
  DescriptionList,
  DescriptionListDescription,
  Divider,
  Form,
  FormGroup,
  FormHelperText,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  HelperTextItemVariant,
  Icon,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Select,
  SelectList,
  SelectOption,
  TextArea,
  TextInput,
  TextInputProps,
  Title,
  Tooltip,
  ValidatedOptions,
} from '@patternfly/react-core';
import { ExclamationCircleIcon, MinusCircleIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { t_global_spacer_sm } from '@patternfly/react-tokens';
import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom-v5-compat';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from '../console/console-shared/src/datetime/prometheus';
import { ExternalLink } from '../console/utils/link';
import { useBoolean } from '../hooks/useBoolean';
import {
  getFetchSilenceAlertUrl,
  getSilenceAlertUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { refreshSilences } from '../utils';
import { DataTestIDs } from '../data-test';

type Matcher = {
  isRegex: boolean;
  isEqual: boolean;
  name: string;
  value: string;
};

type SilenceFormProps = {
  defaults: any;
  Info?: React.ComponentType;
  title: string;
};

// TODO: These will be available in future versions of the plugin SDK
const getUser = (state) => state.sdkCore?.user;

const pad = (i: number): string => (i < 10 ? `0${i}` : String(i));

const formatDate = (d: Date): string =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;

type DatetimeTextInputProps = TextInputProps & {
  tooltip?: string;
};

const DatetimeTextInput = (props: DatetimeTextInputProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const pattern =
    '\\d{4}/(0?[1-9]|1[012])/(0?[1-9]|[12]\\d|3[01]) (0?\\d|1\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?';
  const isValid = new RegExp(`^${pattern}$`).test(String(props.value));

  return (
    <Tooltip
      content={
        props.tooltip
          ? props.tooltip
          : isValid
          ? formatDate(new Date(props.value))
          : t('Invalid date / time')
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
  );
};

const NegativeMatcherHelp = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <DescriptionList>
      <DescriptionListDescription>
        {t('Select the negative matcher option to update the label value to a not equals matcher.')}
      </DescriptionListDescription>
      <DescriptionListDescription>
        {t(
          'If both the RegEx and negative matcher options are selected, the label value must not match the regular expression.',
        )}
      </DescriptionListDescription>
    </DescriptionList>
  );
};

const SilenceForm_: React.FC<SilenceFormProps> = ({ defaults, Info, title }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const navigate = useNavigate();

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
  const [matchers, setMatchers] = React.useState<Array<Matcher>>(
    defaults.matchers ?? [{ isRegex: false, isEqual: true, name: '', value: '' }],
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

  const setMatcherField = (i: number, field: string, v: string | boolean): void => {
    const newMatchers = _.clone(matchers);
    _.set(newMatchers, [i, field], v);
    setMatchers(newMatchers);
  };

  const addMatcher = (): void => {
    setMatchers([...matchers, { isRegex: false, isEqual: false, name: '', value: '' }]);
  };

  const removeMatcher = (i: number): void => {
    const newMatchers = _.clone(matchers);
    newMatchers.splice(i, 1);

    // If all matchers have been removed, add back a single blank matcher
    setMatchers(
      _.isEmpty(newMatchers)
        ? [{ isRegex: false, isEqual: false, name: '', value: '' }]
        : newMatchers,
    );
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
        navigate(getSilenceAlertUrl(perspective, silenceID, namespace));
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
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{title}</Title>
        <HelperText>
          <HelperTextItem data-test={DataTestIDs.SilencesPageFormTestIDs.Description}>
            {t(
              'Silences temporarily mute alerts based on a set of label selectors that you define. Notifications will not be sent for alerts that match all the listed values or regular expressions.',
            )}
          </HelperTextItem>
        </HelperText>
      </PageSection>
      <Divider />

      <PageSection hasBodyWrapper={false}>
        <Form onSubmit={onSubmit} maxWidth="950px">
          {Info && <Info />}
          {error && <Alert variant="danger" isInline title={error} />}
          <Title headingLevel="h2">{t('Duration')}</Title>
          <Grid hasGutter>
            <GridItem sm={4} md={5}>
              <FormGroup label={t('Silence alert from...')}>
                {isStartNow ? (
                  <DatetimeTextInput
                    isDisabled
                    data-test={DataTestIDs.SilencesPageFormTestIDs.SilenceFrom}
                    value={t('Now')}
                    tooltip={formatDate(new Date())}
                  />
                ) : (
                  <DatetimeTextInput
                    data-test={DataTestIDs.SilencesPageFormTestIDs.SilenceFrom}
                    isRequired
                    onChange={(_event, value: string) => setStartsAt(value)}
                    value={startsAt}
                  />
                )}
              </FormGroup>
            </GridItem>
            <GridItem sm={4} md={2}>
              <FormGroup label={t('For...')}>
                <Select
                  data-test={DataTestIDs.SilencesPageFormTestIDs.SilenceFor}
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
                      data-test={DataTestIDs.SilencesPageFormTestIDs.SilenceForToggle}
                    >
                      {duration}
                    </MenuToggle>
                  )}
                  onOpenChange={setIsOpen}
                >
                  <SelectList>{selectOptions}</SelectList>
                </Select>
              </FormGroup>
            </GridItem>
            <GridItem sm={4} md={5}>
              <FormGroup label={t('Until...')}>
                {duration === durationOff ? (
                  <DatetimeTextInput
                    data-test={DataTestIDs.SilencesPageFormTestIDs.SilenceUntil}
                    isRequired
                    onChange={(_event, value: string) => setEndsAt(value)}
                    value={endsAt}
                  />
                ) : (
                  <DatetimeTextInput
                    data-test={DataTestIDs.SilencesPageFormTestIDs.SilenceUntil}
                    isDisabled
                    value={
                      isStartNow
                        ? t('{{duration}} from now', { duration: durations[duration] })
                        : getEndsAtValue()
                    }
                    tooltip={isStartNow ? getEndsAtValue() : undefined}
                  />
                )}
              </FormGroup>
            </GridItem>
          </Grid>
          <FormGroup role="group">
            <Checkbox
              id="start-immediately"
              label={t('Start immediately')}
              isChecked={isStartNow}
              onChange={(e) => setIsStartNow(e.currentTarget.checked)}
              data-test={DataTestIDs.SilencesPageFormTestIDs.StartImmediately}
            />
          </FormGroup>

          <Title headingLevel="h2">{t('Alert labels')}</Title>
          <FormHelperText>
            <HelperText>
              <HelperTextItem
                variant="indeterminate"
                data-test={DataTestIDs.SilencesPageFormTestIDs.AlertLabelsDescription}
              >
                <Trans t={t}>
                  Alerts with labels that match these selectors will be silenced instead of firing.
                  Label values can be matched exactly or with a{' '}
                  <ExternalLink
                    href="https://github.com/google/re2/wiki/Syntax"
                    text={t('regular expression')}
                  />
                </Trans>
              </HelperTextItem>
            </HelperText>
          </FormHelperText>

          {_.map(matchers, (matcher, i: number) => (
            <Grid key={i} sm={12} md={4} hasGutter>
              <GridItem>
                <FormGroup label={t('Label name')}>
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
                    data-test={DataTestIDs.SilencesPageFormTestIDs.LabelName}
                  />
                </FormGroup>
              </GridItem>
              <GridItem>
                <FormGroup label={t('Label value')}>
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
                    data-test={DataTestIDs.SilencesPageFormTestIDs.LabelValue}
                  />
                </FormGroup>
              </GridItem>
              <GridItem>
                <FormGroup isInline label={t('Select all that apply:')}>
                  <FormGroup role="group" isInline style={{ marginTop: t_global_spacer_sm.var }}>
                    <Checkbox
                      id={`regex-${i}`}
                      label={t('RegEx')}
                      isChecked={matcher.isRegex}
                      onChange={(e) => setMatcherField(i, 'isRegex', e.currentTarget.checked)}
                      data-test={DataTestIDs.SilencesPageFormTestIDs.Regex}
                    />
                    <Tooltip content={<NegativeMatcherHelp />}>
                      <Checkbox
                        id={`negative-matcher-${i}`}
                        label={t('Negative matcher')}
                        isChecked={matcher.isEqual === false}
                        onChange={(e) => setMatcherField(i, 'isEqual', !e.currentTarget.checked)}
                        data-test={DataTestIDs.SilencesPageFormTestIDs.NegativeMatcherCheckbox}
                      />
                    </Tooltip>
                  </FormGroup>
                  <Tooltip content={t('Remove')}>
                    <Button
                      icon={<MinusCircleIcon />}
                      type="button"
                      onClick={() => removeMatcher(i)}
                      aria-label={t('Remove')}
                      variant="plain"
                      isInline
                      data-test={DataTestIDs.SilencesPageFormTestIDs.RemoveLabel}
                    />
                  </Tooltip>
                </FormGroup>
              </GridItem>
            </Grid>
          ))}

          <FormGroup>
            <Button
              icon={
                <Icon isInline size="lg" iconSize="md">
                  <PlusCircleIcon />
                </Icon>
              }
              onClick={addMatcher}
              type="button"
              variant="link"
              isInline
              data-test={DataTestIDs.SilencesPageFormTestIDs.AddLabel}
            >
              {t('Add label')}
            </Button>
          </FormGroup>

          <Title headingLevel="h2">{t('Info')}</Title>
          <FormGroup label={t('Creator')} isRequired>
            <TextInput
              aria-label={t('Creator')}
              isRequired
              onChange={(_e, v: string) =>
                typeof _e === 'string' ? setCreatedBy(_e) : setCreatedBy(v)
              }
              value={createdBy}
              validated={error && !createdBy ? ValidatedOptions.error : ValidatedOptions.default}
              data-test={DataTestIDs.SilencesPageFormTestIDs.Creator}
            />
            {error && !createdBy && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem
                    icon={<ExclamationCircleIcon />}
                    variant={HelperTextItemVariant.error}
                  >
                    {t('Required')}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <FormGroup label={t('Comment')} isRequired>
            <TextArea
              aria-label={t('Comment')}
              isRequired
              onChange={(_e, v: string) =>
                typeof _e === 'string' ? setComment(_e) : setComment(v)
              }
              data-test={DataTestIDs.SilencesPageFormTestIDs.Comment}
              value={comment}
              validated={error && !comment ? ValidatedOptions.error : ValidatedOptions.default}
            />
            {error && !comment && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem
                    icon={<ExclamationCircleIcon />}
                    variant={HelperTextItemVariant.error}
                  >
                    {t('Required')}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <ActionGroup>
            <Button
              type="submit"
              variant="primary"
              isDisabled={inProgress}
              data-test={DataTestIDs.SilenceButton}
            >
              {t('Silence')}
            </Button>
            <Button
              onClick={() => navigate(-1)}
              variant="secondary"
              isDisabled={inProgress}
              data-test={DataTestIDs.CancelButton}
            >
              {t('Cancel')}
            </Button>
          </ActionGroup>
        </Form>
      </PageSection>
    </>
  );
};

export const SilenceForm = withFallback(SilenceForm_);
