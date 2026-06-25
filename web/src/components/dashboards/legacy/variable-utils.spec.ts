import { evaluateVariableTemplate, Variable } from './variable-utils';
import { MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from './utils';

const timespan = 30 * 60 * 1000; // 30 minutes
const makeVariables = (
  overrides: Record<string, Partial<Variable>> = {},
): Record<string, Variable> => {
  const vars: Record<string, Variable> = {};
  for (const [k, v] of Object.entries(overrides)) {
    vars[k] = { value: '', ...v } as Variable;
  }
  return vars;
};

describe('evaluateVariableTemplate', () => {
  it('substitutes a literal value in exact match context', () => {
    const vars = makeVariables({ job: { value: 'prometheus' } });
    expect(evaluateVariableTemplate('metric{job="$job"}', vars, timespan, '')).toBe(
      'metric{job="prometheus"}',
    );
  });

  it('substitutes multiple variables', () => {
    const vars = makeVariables({
      job: { value: 'prometheus' },
      instance: { value: 'localhost:9090' },
    });
    expect(
      evaluateVariableTemplate('metric{job="$job",instance="$instance"}', vars, timespan, ''),
    ).toBe('metric{job="prometheus",instance="localhost:9090"}');
  });

  it('escapes IPv6 brackets in =~ context', () => {
    const vars = makeVariables({ instance: { value: '[fd02:0:0:1::6]:9092' } });
    expect(evaluateVariableTemplate('metric{instance=~"$instance"}', vars, timespan, '')).toBe(
      'metric{instance=~"\\\\[fd02:0:0:1::6\\\\]:9092"}',
    );
  });

  it('does NOT escape IPv6 brackets in = context', () => {
    const vars = makeVariables({ instance: { value: '[fd02:0:0:1::6]:9092' } });
    expect(evaluateVariableTemplate('metric{instance="$instance"}', vars, timespan, '')).toBe(
      'metric{instance="[fd02:0:0:1::6]:9092"}',
    );
  });

  it('escapes dots in =~ context', () => {
    const vars = makeVariables({ host: { value: 'my.host.example.com' } });
    expect(evaluateVariableTemplate('metric{host=~"$host"}', vars, timespan, '')).toBe(
      'metric{host=~"my\\\\.host\\\\.example\\\\.com"}',
    );
  });

  it('escapes in !~ context', () => {
    const vars = makeVariables({ instance: { value: '[::1]:9090' } });
    expect(evaluateVariableTemplate('metric{instance!~"$instance"}', vars, timespan, '')).toBe(
      'metric{instance!~"\\\\[::1\\\\]:9090"}',
    );
  });

  it('does NOT escape in != context', () => {
    const vars = makeVariables({ instance: { value: '[::1]:9090' } });
    expect(evaluateVariableTemplate('metric{instance!="$instance"}', vars, timespan, '')).toBe(
      'metric{instance!="[::1]:9090"}',
    );
  });

  it('does NOT escape .+ for ALL option in =~ context', () => {
    const vars = makeVariables({
      instance: { value: MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY },
    });
    expect(evaluateVariableTemplate('metric{instance=~"$instance"}', vars, timespan, '')).toBe(
      'metric{instance=~".+"}',
    );
  });

  it('applies different escaping per site for the same variable in mixed contexts', () => {
    const vars = makeVariables({ var: { value: '[test]' } });
    expect(
      evaluateVariableTemplate('metric{a=~"$var"} + other{b="$var"}', vars, timespan, ''),
    ).toBe('metric{a=~"\\\\[test\\\\]"} + other{b="[test]"}');
  });

  it('handles interval variables in range selector', () => {
    const vars = makeVariables({ job: { value: 'prometheus' } });
    const result = evaluateVariableTemplate(
      'rate(metric{job="$job"}[$__interval])',
      vars,
      timespan,
      '',
    );
    expect(result).toMatch(/^rate\(metric\{job="prometheus"\}\[\d+m\]\)$/);
  });

  it('returns undefined for empty template', () => {
    expect(evaluateVariableTemplate('', {}, timespan, '')).toBeUndefined();
  });

  it('returns undefined when variable is loading', () => {
    const vars = makeVariables({ job: { value: 'x', isLoading: true } });
    expect(evaluateVariableTemplate('metric{job="$job"}', vars, timespan, '')).toBeUndefined();
  });

  it('overrides namespace variable with the provided namespace', () => {
    const vars = makeVariables({ namespace: { value: 'stored-ns' } });
    expect(
      evaluateVariableTemplate('metric{namespace="$namespace"}', vars, timespan, 'actual-ns'),
    ).toBe('metric{namespace="actual-ns"}');
  });

  it('uses ALL option .+ correctly alongside escaped variable', () => {
    const vars = makeVariables({
      job: { value: MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY },
      instance: { value: '[fd02:0:0:1::6]:9092' },
    });
    const result = evaluateVariableTemplate(
      'sum(rate(prometheus_target_sync_length_seconds_sum{job=~"$job",instance=~"$instance"}[5m])) by (scrape_job) * 1e3',
      vars,
      timespan,
      '',
    );
    expect(result).toBe(
      'sum(rate(prometheus_target_sync_length_seconds_sum{job=~".+",instance=~"\\\\[fd02:0:0:1::6\\\\]:9092"}[5m])) by (scrape_job) * 1e3',
    );
  });

  it('escapes variable value after a literal prefix in =~ context', () => {
    const vars = makeVariables({ pod: { value: '[test]' } });
    expect(evaluateVariableTemplate('metric{pod=~"prefix-$pod"}', vars, timespan, '')).toBe(
      'metric{pod=~"prefix-\\\\[test\\\\]"}',
    );
  });

  it('escapes variable value after a literal prefix in !~ context', () => {
    const vars = makeVariables({ suffix: { value: 'a.b' } });
    expect(evaluateVariableTemplate('metric{path!~".*api.*$suffix"}', vars, timespan, '')).toBe(
      'metric{path!~".*api.*a\\\\.b"}',
    );
  });

  it('escapes both variables inside a single =~ matcher', () => {
    const vars = makeVariables({
      prefix: { value: 'hello.world' },
      suffix: { value: '[test]' },
    });
    expect(evaluateVariableTemplate('metric{pod=~"$prefix-$suffix"}', vars, timespan, '')).toBe(
      'metric{pod=~"hello\\\\.world-\\\\[test\\\\]"}',
    );
  });

  it('does NOT escape variable after a literal prefix in = context', () => {
    const vars = makeVariables({ pod: { value: '[test]' } });
    expect(evaluateVariableTemplate('metric{pod="prefix-$pod"}', vars, timespan, '')).toBe(
      'metric{pod="prefix-[test]"}',
    );
  });

  it('__range_ms substitutes the millisecond value', () => {
    const vars = makeVariables({});
    expect(evaluateVariableTemplate('foo[$__range_ms]', vars, timespan, '')).toBe('foo[1800000]');
  });

  it('__range_s substitutes numeric seconds without suffix', () => {
    const vars = makeVariables({});
    expect(evaluateVariableTemplate('foo[$__range_s]', vars, timespan, '')).toBe('foo[1800]');
  });

  it('__range substitutes seconds with s suffix', () => {
    const vars = makeVariables({});
    expect(evaluateVariableTemplate('foo[$__range]', vars, timespan, '')).toBe('foo[1800s]');
  });
});
