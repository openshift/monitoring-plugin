import trace from '@/features/tracing/pages/TraceDetailPage/testdata/trace.json';
import transformedTrace from '@/features/tracing/pages/TraceDetailPage/testdata/transformed.json';
import { transformTrace } from '@/features/tracing/pages/TraceDetailPage/transform-trace';

describe('transform trace', () => {
  it('should transform a trace to LLM friendly format', () => {
    expect(transformTrace(trace)).toEqual(transformedTrace);
  });
});
