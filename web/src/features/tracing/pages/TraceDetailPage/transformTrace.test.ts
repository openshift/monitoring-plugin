/* eslint-disable local-rules/file-naming -- Renamed in the Jest to Vitest port. */
import * as trace from '@/features/tracing/pages/TraceDetailPage/testdata/trace.json';
import * as transformedTrace from '@/features/tracing/pages/TraceDetailPage/testdata/transformed.json';
import { transformTrace } from '@/features/tracing/pages/TraceDetailPage/transform-trace';

describe('transform trace', () => {
  it('should transform a trace to LLM friendly format', () => {
    expect(transformTrace(trace)).toEqual(transformedTrace);
  });
});
