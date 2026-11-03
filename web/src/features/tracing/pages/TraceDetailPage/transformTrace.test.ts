import { transformTrace } from './transformTrace';
import * as trace from './testdata/trace.json';
import * as transformedTrace from './testdata/transformed.json';

describe('transform trace', () => {
  it('should transform a trace to LLM friendly format', () => {
    expect(transformTrace(trace)).toEqual(transformedTrace);
  });
});
