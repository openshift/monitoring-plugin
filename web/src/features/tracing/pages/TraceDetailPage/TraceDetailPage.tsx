import { useMemo } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Divider,
  PageSection,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { DocumentTitle } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import {
  PersesDashboardWrapper,
  PersesTempoDatasourceWrapper,
  PersesTracePanelWrapper,
  PersesWrapper,
} from '../../components/PersesWrapper';
import { useDataQueries } from '@perses-dev/plugin-system';
import { useTempoInstance } from '../../hooks/useTempoInstance';
import { TracingApp } from '../../TracingApp';
import { linkToSpan, linkToTrace, spanAttributeLinks } from '../../links';
import { StringParam, useQueryParam } from 'use-query-params';
import './TraceDetailPage.css';
import { MagicIcon } from '@patternfly/react-icons';
import { dump as dumpYAML } from 'js-yaml';
import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { AttachmentTypes, isOpenOLSHandlerExtension, OpenOLSHandlerProps } from '../../hooks/ols';
import { transformTrace } from './transformTrace';

function TraceDetailPage() {
  return (
    <TracingApp>
      <PersesWrapper>
        <PersesDashboardWrapper>
          <TraceDetailPageBody />
        </PersesDashboardWrapper>
      </PersesWrapper>
    </TracingApp>
  );
}

export default TraceDetailPage;

function TraceDetailPageBody() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const { traceId } = useParams();
  const [tempo] = useTempoInstance();
  const location = useLocation();
  const [selectedSpanId] = useQueryParam('selectSpan', StringParam);

  return (
    <PersesTempoDatasourceWrapper
      tempo={tempo}
      definitions={[
        {
          kind: 'TraceQuery',
          spec: { plugin: { kind: 'TempoTraceQuery', spec: { query: traceId } } },
        },
      ]}
    >
      <PageSection>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to={`/observe/traces${location.search}`}>{t('Traces')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{t('Trace details')}</BreadcrumbItem>
        </Breadcrumb>
        <PageTitle />
        <Divider className="pf-v6-u-mt-md" />
      </PageSection>
      <PageSection
        isFilled
        hasBodyWrapper={false}
        className="mui-pf-theme"
        style={{ paddingTop: 0 }}
      >
        <GanttChart traceId={traceId} selectedSpanId={selectedSpanId} />
      </PageSection>
    </PersesTempoDatasourceWrapper>
  );
}

interface GanttChartProps {
  traceId?: string;
  selectedSpanId?: string | null;
}

function GanttChart({ traceId, selectedSpanId }: GanttChartProps) {
  const traceName = useTraceName();
  const { queryResults } = useDataQueries('TraceQuery');
  const trace = queryResults[0]?.data?.trace;

  const [extensions, resolved] = useResolvedExtensions(isOpenOLSHandlerExtension);
  const useOpenOLS = resolved
    ? (extensions[0]?.properties?.provider as OpenOLSHandlerProps['provider'])
    : undefined;

  // Due to some Perses <Panel> internals, useMemo() doesn't work reliably inside panelOptions.extra
  // Therefore we'll perform the trace transformation in this component and pass it to <LightspeedButton> as a prop.
  const lightspeedBtn = useMemo(() => {
    if (!useOpenOLS) return null;
    if (!trace) return null;

    let traceYaml = '';
    try {
      const transformedTrace = transformTrace(trace);
      if (!transformedTrace) {
        return null;
      }

      traceYaml = dumpYAML(transformedTrace, { lineWidth: -1 });
    } catch (e) {
      console.error('Error while transforming trace', e);
      return null;
    }

    return <LightspeedButton useOpenOLS={useOpenOLS} traceName={traceName} traceYaml={traceYaml} />;
  }, [useOpenOLS, traceName, trace]);

  return (
    <div className="dt-plugin-perses-panel dt-plugin-gantt-chart">
      <PersesTracePanelWrapper
        panelOptions={{
          showIcons: 'always',
          extra: lightspeedBtn ? () => lightspeedBtn : undefined,
        }}
        definition={{
          kind: 'Panel',
          spec: {
            display: { name: `Trace ${traceId}` },
            plugin: {
              kind: 'TracingGanttChart',
              spec: {
                visual: {
                  palette: {
                    mode: 'categorical',
                  },
                },
                links: {
                  trace: linkToTrace(),
                  span: linkToSpan(),
                  attributes: spanAttributeLinks,
                },
                selectedSpanId,
              },
            },
          },
        }}
      />
    </div>
  );
}

function PageTitle() {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const traceName = useTraceName();

  return (
    <>
      <DocumentTitle>{`${t('Trace')} ${traceName} · ${t('Tracing')}`}</DocumentTitle>
      <Title headingLevel="h1">{traceName}</Title>
    </>
  );
}

function useTraceName(): string {
  const { traceId } = useParams();
  const { queryResults } = useDataQueries('TraceQuery');
  const trace = queryResults[0]?.data?.trace;

  for (const resourceSpan of trace?.resourceSpans ?? []) {
    for (const scopeSpan of resourceSpan.scopeSpans) {
      for (const span of scopeSpan.spans) {
        if (!span.parentSpanId) {
          // found a root span, look for service name attribute
          for (const attr of resourceSpan.resource?.attributes ?? []) {
            if (attr.key === 'service.name' && 'stringValue' in attr.value) {
              return `${attr.value.stringValue}: ${span.name}`;
            }
          }
        }
      }
    }
  }

  // return traceId if span is not loaded or root span is not found
  return traceId ?? '';
}

const defaultPrompt =
  'Analyze this distributed trace from my OpenShift cluster and summarize: errors, services needing investigation and performance bottlenecks.';
const MAX_TRACE_SIZE_MB = 1;

interface LightspeedButtonProps {
  useOpenOLS: OpenOLSHandlerProps['provider'];
  traceName: string;
  traceYaml: string;
}

function LightspeedButton({ useOpenOLS, traceName, traceYaml }: LightspeedButtonProps) {
  const { t } = useTranslation('plugin__distributed-tracing-console-plugin');
  const openOLS = useOpenOLS();

  const handleTraceAISummaryClick = () => {
    const traceAttachment = {
      attachmentType: AttachmentTypes.YAML,
      kind: 'Trace',
      name: traceName,
      value: traceYaml,
      namespace: '',
    };
    openOLS(defaultPrompt, [traceAttachment]);

    // Workaround to trigger resizing of Lightspeed UI input field
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 0);
  };

  // Sanity check to avoid sending large traces to the LLM
  if (traceYaml.length > MAX_TRACE_SIZE_MB * 1024 * 1024) {
    const errorMsg = t(
      'Trace is too large to be analyzed by OpenShift Lightspeed. Max size is {{max}} MB.',
      { max: MAX_TRACE_SIZE_MB },
    );

    return (
      <Tooltip content={errorMsg}>
        <Button isAriaDisabled variant="plain" aria-label={errorMsg} icon={<MagicIcon />} />
      </Tooltip>
    );
  }

  return (
    <Tooltip content={t('Ask OpenShift Lightspeed')}>
      <Button
        variant="plain"
        onClick={handleTraceAISummaryClick}
        aria-label={t('Ask OpenShift Lightspeed')}
        icon={<MagicIcon />}
      />
    </Tooltip>
  );
}
