import { otlpcommonv1, otlptracev1 } from '@perses-dev/spec';

/**
 * Convert the trace from OTLP/JSON to a more LLM-friendly format:
 * * convert attributes from arrays of nested objects to an object
 * * calculate span duration
 */
export function transformTrace(trace: otlptracev1.TracesData) {
  const traceId = trace.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.traceId;
  if (!traceId) {
    return;
  }

  return {
    traceId,
    resourceSpans: trace.resourceSpans.map(transformResourceSpan),
  };
}

function transformResourceSpan(resourceSpan: otlptracev1.ResourceSpan) {
  const resourceAttributes = resourceSpan.resource?.attributes;
  return {
    ...(resourceAttributes ? { attributes: transformAttributes(resourceAttributes) } : {}),
    scopeSpans: resourceSpan.scopeSpans.map(transformScopeSpan),
  };
}

function transformScopeSpan(scopeSpan: otlptracev1.ScopeSpans) {
  return {
    ...(scopeSpan.scope?.name ? { scope: transformScope(scopeSpan.scope) } : {}),
    spans: scopeSpan.spans.map(transformSpan),
  };
}

function transformScope(scope: otlpcommonv1.InstrumentationScope) {
  return {
    ...(scope?.name ? { name: scope.name } : {}),
  };
}

function transformSpan(span: otlptracev1.Span) {
  const startMs = parseInt(span.startTimeUnixNano) * 1e-6;
  const endMs = parseInt(span.endTimeUnixNano) * 1e-6;
  const durationMs = Math.round((endMs - startMs) * 1000) / 1000;

  return {
    spanId: span.spanId,
    ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name,
    kind: span.kind,
    startTimeUnixNano: span.startTimeUnixNano,
    endTimeUnixNano: span.endTimeUnixNano,
    durationMs,
    ...(span.attributes ? { attributes: transformAttributes(span.attributes) } : {}),
    ...(span.events ? { events: span.events.map(transformEvent) } : {}),
    ...(span.links ? { links: span.links.map(transformLink) } : {}),
    ...(span.status?.code || span.status?.message ? { status: span.status } : {}),
  };
}

function transformEvent(event: otlptracev1.Event) {
  return {
    name: event.name,
    timeUnixNano: event.timeUnixNano,
    ...(event.attributes ? { attributes: transformAttributes(event.attributes) } : {}),
  };
}

function transformLink(link: otlptracev1.Link) {
  return {
    traceId: link.traceId,
    spanId: link.spanId,
    ...(link.attributes ? { attributes: transformAttributes(link.attributes) } : {}),
  };
}

function transformAttributes(attributes: otlpcommonv1.KeyValue[]) {
  return Object.fromEntries(
    attributes.map((attribute) => [attribute.key, transformAttributeValue(attribute.value)]),
  );
}

type AttributeType = string | number | boolean | undefined | AttributeType[];
function transformAttributeValue(value: otlpcommonv1.AnyValue): AttributeType {
  if ('stringValue' in value) return value.stringValue;
  if ('intValue' in value) return parseInt(value.intValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('boolValue' in value) return value.boolValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(transformAttributeValue);
  return undefined;
}
