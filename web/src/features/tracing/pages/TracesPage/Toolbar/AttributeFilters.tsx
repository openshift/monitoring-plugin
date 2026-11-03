import { ReactElement, ReactNode, useState } from 'react';
import {
  ToolbarGroup,
  ToolbarItem,
  ToolbarFilter,
  Popover,
  Form,
  FormGroup,
} from '@patternfly/react-core';
import { FilterIcon, HelpIcon } from '@patternfly/react-icons';
import { Trans, useTranslation } from 'react-i18next';
import { TempoInstance } from '../../../hooks/useTempoInstance';
import { ControlledSimpleSelect } from '../../../components/ControlledSelects';
import { TypeaheadSelectOption } from '../../../components/TypeaheadSelect';
import { filterToTraceQL } from './Filter/traceql_from_filter';
import {
  DebouncedTextInput,
  DebouncedTextInputProps,
} from '../../../components/DebouncedTextInput';
import { traceQLToFilter } from './Filter/traceql_to_filter';
import { TypeaheadCheckboxSelect } from '../../../components/TypeaheadCheckboxSelect';
import { DurationField, Filter, splitByUnquotedWhitespace } from './Filter/filter';
import { useTagValues } from '../../../hooks/useTagValues';
import { Link } from 'react-router';
import { useTimeRange } from '@perses-dev/plugin-system';
import { getUnixTimeRange } from '@perses-dev/tempo-plugin';

const k8sAttributesProcessorLink =
  'https://docs.redhat.com/en/documentation/red_hat_build_of_opentelemetry/latest/html/configuring_the_collector/otel-collector-processors#otel-processors-kubernetes-attributes-processor_otel-collector-processors';

const serviceNameFilter = { content: 'Service Name', value: 'serviceName' };
const spanNameFilter = { content: 'Span Name', value: 'spanName' };
const namespaceFilter = { content: 'Namespace', value: 'namespace' };
const statusFilter = { content: 'Status', value: 'status' };
const spanDurationFilter = { content: 'Span Duration', value: 'spanDuration' };
const traceDurationFilter = { content: 'Trace Duration', value: 'traceDuration' };
const customAttributeFilter = { content: 'Custom Attributes', value: 'attribute' };
const attributeFilterOptions = [
  serviceNameFilter,
  spanNameFilter,
  namespaceFilter,
  statusFilter,
  spanDurationFilter,
  traceDurationFilter,
  customAttributeFilter,
];

interface AttributeFiltersProps {
  tempo: TempoInstance | undefined;
  query: string;
  runQuery: (query: string) => void;
}

const statusOptions = [
  { content: 'unset', value: 'unset' },
  { content: 'ok', value: 'ok' },
  { content: 'error', value: 'error' },
];

export function AttributeFilters(props: AttributeFiltersProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { tempo, query, runQuery } = props;
  const [activeFilter, setActiveFilter] = useState<string | undefined>(
    attributeFilterOptions[0].value,
  );

  const filter = traceQLToFilter(query);
  const setFilter = (filter: Filter) => {
    runQuery(filterToTraceQL(filter));
  };

  const { absoluteTimeRange } = useTimeRange();
  const { start, end } = getUnixTimeRange(absoluteTimeRange);

  const { data: serviceNameOptions } = useTagValues(
    tempo,
    'resource.service.name',
    filterToTraceQL({ ...filter, serviceName: [] }),
    activeFilter === serviceNameFilter.value,
    start,
    end,
  );
  const { data: spanNameOptions } = useTagValues(
    tempo,
    'name',
    filterToTraceQL({ ...filter, spanName: [] }),
    activeFilter === spanNameFilter.value,
    start,
    end,
  );
  const { data: namespaceOptions } = useTagValues(
    tempo,
    'resource.k8s.namespace.name',
    filterToTraceQL({ ...filter, namespace: [] }),
    activeFilter === namespaceFilter.value,
    start,
    end,
  );

  return (
    <ToolbarGroup variant="filter-group">
      <ToolbarItem>
        <Form>
          <FormGroup fieldId="active-filter-select" label={t('Filter')}>
            <ControlledSimpleSelect
              id="active-filter-select"
              options={attributeFilterOptions}
              value={activeFilter}
              setValue={setActiveFilter}
              toggleProps={{ icon: <FilterIcon /> }}
            />
          </FormGroup>
        </Form>
      </ToolbarItem>
      <TypeaheadStringAttributeFilter
        filterName={serviceNameFilter.content}
        show={activeFilter === serviceNameFilter.value}
        options={serviceNameOptions ?? []}
        value={filter.serviceName}
        setValue={(x) => setFilter({ ...filter, serviceName: x })}
      />
      <TypeaheadStringAttributeFilter
        filterName={spanNameFilter.content}
        show={activeFilter === spanNameFilter.value}
        options={spanNameOptions ?? []}
        value={filter.spanName}
        setValue={(x) => setFilter({ ...filter, spanName: x })}
      />
      <TypeaheadStringAttributeFilter
        filterName={namespaceFilter.content}
        label={namespaceFilter.content}
        labelHelp={
          <Popover
            headerContent={<div>{t('Filter by namespace')}</div>}
            bodyContent={
              <div>
                <Trans t={t}>
                  This filter is based on the <code>k8s.namespace.name</code> resource attribute. To
                  set this attribute, it is recommended to enable the{' '}
                  <Link to={k8sAttributesProcessorLink}>Kubernetes Attributes Processor</Link> in
                  your OpenTelemetry Collector pipeline.
                </Trans>
              </div>
            }
          >
            <HelpIcon />
          </Popover>
        }
        noResultsFoundText={
          <Trans t={t}>
            No results found. Please ensure that the{' '}
            <Link to={k8sAttributesProcessorLink}>Kubernetes Attributes Processor</Link>
            <br />
            is enabled in your OpenTelemetry collector pipeline.
          </Trans>
        }
        show={activeFilter === namespaceFilter.value}
        options={namespaceOptions ?? []}
        value={filter.namespace}
        setValue={(x) => setFilter({ ...filter, namespace: x })}
      />
      <TypeaheadStringAttributeFilter
        filterName={statusFilter.content}
        show={activeFilter === statusFilter.value}
        options={statusOptions ?? []}
        value={filter.status}
        setValue={(x) => setFilter({ ...filter, status: x })}
      />
      <DurationAttributeFilter
        filterName={spanDurationFilter.content}
        show={activeFilter === spanDurationFilter.value}
        value={filter.spanDuration}
        setValue={(value) => setFilter({ ...filter, spanDuration: value })}
      />
      <DurationAttributeFilter
        filterName={traceDurationFilter.content}
        show={activeFilter === traceDurationFilter.value}
        value={filter.traceDuration}
        setValue={(value) => setFilter({ ...filter, traceDuration: value })}
      />
      <CustomAttributesFilter
        filterName={customAttributeFilter.content}
        show={activeFilter === customAttributeFilter.value}
        value={filter.customMatchers}
        setValue={(value) => setFilter({ ...filter, customMatchers: value })}
      />
    </ToolbarGroup>
  );
}

interface TypeaheadStringAttributeFilterProps {
  filterName: string;
  label?: ReactNode;
  labelHelp?: ReactElement;
  noResultsFoundText?: ReactNode;
  show?: boolean;
  options: TypeaheadSelectOption[];
  value: string[];
  setValue: (value: string[]) => void;
}

function TypeaheadStringAttributeFilter(props: TypeaheadStringAttributeFilterProps) {
  const { filterName, label, labelHelp, noResultsFoundText, show, options, value, setValue } =
    props;

  return (
    <ToolbarFilter
      labels={value}
      deleteLabel={(_category, label) => setValue(value.filter((x) => x !== label))}
      deleteLabelGroup={() => setValue([])}
      categoryName={filterName}
      showToolbarItem={show}
    >
      <Form onSubmit={(e) => e.preventDefault()}>
        <FormGroup label={label ?? <>&nbsp;</>} labelHelp={labelHelp}>
          <TypeaheadCheckboxSelect
            isCreatable={true}
            toggleWidth="20em"
            placeholder={`Filter by ${filterName}${
              value.length > 0 ? ' (' + value.length + ')' : ''
            }`}
            noResultsFoundText={noResultsFoundText}
            options={options}
            value={value}
            setValue={setValue}
            style={{ maxHeight: '50vh', overflow: 'auto' }}
          />
        </FormGroup>
      </Form>
    </ToolbarFilter>
  );
}

interface DurationAttributeFilterProps {
  filterName: string;
  show?: boolean;
  value: DurationField;
  setValue: (value: DurationField) => void;
}

function DurationAttributeFilter(props: DurationAttributeFilterProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { filterName, show, value, setValue } = props;
  const { min, max } = value;

  let labels: string[] = [];
  if (min && max) {
    labels = [t('between {{min}} and {{max}}', { min, max })];
  } else if (min) {
    labels = [t('greater than {{min}}', { min })];
  } else if (max) {
    labels = [t('less than {{max}}', { max })];
  }

  return (
    <ToolbarFilter
      labels={labels}
      deleteLabel={() => setValue({ min: undefined, max: undefined })}
      deleteLabelGroup={() => setValue({ min: undefined, max: undefined })}
      categoryName={filterName}
      showToolbarItem={show}
    >
      <Form onSubmit={(e) => e.preventDefault()}>
        <FormGroup fieldId="min-duration-input" label={t('Min duration')} style={{ width: '14em' }}>
          <DurationTextInput
            id="min-duration-input"
            placeholder={t('e.g. 100ms')}
            aria-label="min duration"
            value={min ?? ''}
            setValue={(min) => setValue({ min, max })}
          />
        </FormGroup>
      </Form>
      <Form onSubmit={(e) => e.preventDefault()}>
        <FormGroup fieldId="max-duration-input" label={t('Max duration')} style={{ width: '14em' }}>
          <DurationTextInput
            id="max-duration-input"
            placeholder={t('e.g. 100ms')}
            aria-label="max duration"
            value={max ?? ''}
            setValue={(max) => setValue({ min, max })}
          />
        </FormGroup>
      </Form>
    </ToolbarFilter>
  );
}

type DurationTextInputProps = Omit<
  DebouncedTextInputProps,
  'waitTime' | 'validationRegex' | 'validationFailedMessage'
>;

const durationFormatRegex = /^([0-9]+\.)?[0-9]+(ns|ms|s|m|h)$/;

export function DurationTextInput(props: DurationTextInputProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');

  return (
    <DebouncedTextInput
      {...props}
      waitTime={1000}
      validationRegex={durationFormatRegex}
      validationFailedMessage={t(
        'Invalid format. Accepted format e.g. 100ms, accepted units: ns, ms, s, m, h',
      )}
    />
  );
}

interface CustomAttributesFilterProps {
  filterName: string;
  show?: boolean;
  value: string[];
  setValue: (value: string[]) => void;
}

function CustomAttributesFilter(props: CustomAttributesFilterProps) {
  const { filterName, show, value, setValue } = props;
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');

  return (
    <ToolbarFilter
      labels={value}
      deleteLabel={(_category, label) => setValue(value.filter((x) => x !== label))}
      deleteLabelGroup={() => setValue([])}
      categoryName={filterName}
      showToolbarItem={show}
    >
      <Form onSubmit={(e) => e.preventDefault()}>
        <FormGroup
          fieldId="custom-attributes-input"
          label={t('Custom attributes')}
          labelHelp={
            <Popover
              headerContent={<div>{t('Filter by attributes')}</div>}
              bodyContent={
                <div>
                  {t(
                    'Attributes are written in the form key=value and are combined via AND. Multiple attributes can be separated via space. String values must be quoted. Example:',
                  )}{' '}
                  <code>{'span.http.status_code=200 span.http.method="GET" duration>5s'}</code>
                </div>
              }
            >
              <HelpIcon />
            </Popover>
          }
        >
          <DebouncedTextInput
            id="custom-attributes-input"
            size={50}
            placeholder={'span.http.status_code=200 span.http.method="GET"'}
            aria-label="custom attributes"
            waitTime={5000}
            value={value.join(' ')}
            setValue={(x) => setValue(splitByUnquotedWhitespace(x))}
          />
        </FormGroup>
      </Form>
    </ToolbarFilter>
  );
}
