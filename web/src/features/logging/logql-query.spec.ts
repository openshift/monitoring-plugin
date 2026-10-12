import { LogQLQuery } from '@/features/logging/logql-query';

describe('LogQL query', () => {
  it('should parse a logql query', () => {
    [
      { query: '{}', expected: { selectorMatchers: [], pipeline: [] } },
      {
        query: '{} | json',
        expected: {
          selectorMatchers: [],
          pipeline: [{ operator: '|', value: 'json' }],
        },
      },
      { query: '{,}', expected: { selectorMatchers: [], pipeline: [] } },
      {
        query: '{foo="bar"}',
        expected: {
          selectorMatchers: [{ label: 'foo', operator: '=', value: '"bar"' }],
          pipeline: [],
        },
      },
      {
        query: '{foo="bar",baz="zad"}',
        expected: {
          selectorMatchers: [
            { label: 'foo', operator: '=', value: '"bar"' },
            { label: 'baz', operator: '=', value: '"zad"' },
          ],
          pipeline: [],
        },
      },
      {
        query: '{foo="bar",baz="zad"} invalid_pipeline',
        expected: {
          selectorMatchers: [
            { label: 'foo', operator: '=', value: '"bar"' },
            { label: 'baz', operator: '=', value: '"zad"' },
          ],
          pipeline: [],
        },
      },
      {
        query: '{foo="bar",baz="zad"} !="ignore this text"',
        expected: {
          selectorMatchers: [
            { label: 'foo', operator: '=', value: '"bar"' },
            { label: 'baz', operator: '=', value: '"zad"' },
          ],
          pipeline: [{ operator: '!=', value: '"ignore this text"' }],
        },
      },
      {
        query:
          '{foo="bar",baz="zad"} !="ignore this text" | a=~"err|error" or level="" or level="unknown"',
        expected: {
          selectorMatchers: [
            { label: 'foo', operator: '=', value: '"bar"' },
            { label: 'baz', operator: '=', value: '"zad"' },
          ],
          pipeline: [
            { operator: '!=', value: '"ignore this text"' },
            {
              operator: '|',
              value: 'a=~"err|error" or level="" or level="unknown"',
              labelsInFilter: [
                { label: 'a', operator: '=~', value: '"err|error"' },
                { label: 'level', operator: '=', value: '""' },
                {
                  label: 'level',
                  operator: '=',
                  value: '"unknown"',
                },
              ],
            },
          ],
        },
      },
      {
        query: '{} | duration >= 20ms or size == 20kb and method!~"200"',
        expected: {
          selectorMatchers: [],
          pipeline: [
            {
              operator: '|',
              value: 'duration >= 20ms or size == 20kb and method!~"200"',
              labelsInFilter: [
                {
                  label: 'method',
                  operator: '!~',
                  value: '"200"',
                },
              ],
            },
          ],
        },
      },
      {
        query:
          '{ foo="bar", baz="zad" } |="content" |  json | level="unknown" or level=~"error|err" | line_format "{{.message}}"',
        expected: {
          selectorMatchers: [
            { label: 'foo', operator: '=', value: '"bar"' },
            { label: 'baz', operator: '=', value: '"zad"' },
          ],
          pipeline: [
            { operator: '|=', value: '"content"', labelsInFilter: undefined },
            { operator: '|', value: 'json', labelsInFilter: undefined },
            {
              operator: '|',
              value: 'level="unknown" or level=~"error|err"',
              labelsInFilter: [
                { label: 'level', operator: '=', value: '"unknown"' },
                { label: 'level', operator: '=~', value: '"error|err"' },
              ],
            },
            {
              operator: '|',
              value: 'line_format "{{.message}}"',
              labelsInfilter: undefined,
            },
          ],
        },
      },
      {
        query:
          'sum by (level) (count_over_time({ log_type =~ ".+" } | json | level="unknown" or level="" or level=~"emerg|fatal|alert|crit|critical|err|error|eror|warn|warning|inf|info|information|notice" [1m]))',
        expected: {
          selectorMatchers: [{ label: 'log_type', operator: '=~', value: '".+"' }],
          pipeline: [
            { operator: '|', value: 'json', labelsInFilter: undefined },
            {
              operator: '|',
              value:
                'level="unknown" or level="" or level=~"emerg|fatal|alert|crit|critical|err|error|eror|warn|warning|inf|info|information|notice"',
              labelsInFilter: [
                {
                  label: 'level',
                  operator: '=',
                  value: '"unknown"',
                },
                {
                  label: 'level',
                  operator: '=',
                  value: '""',
                },
                {
                  label: 'level',
                  operator: '=~',
                  value:
                    '"emerg|fatal|alert|crit|critical|err|error|eror|warn|warning|inf|info|information|notice"',
                },
              ],
            },
          ],
        },
      },
      {
        query:
          '(sum((count_over_time({title="martian", second="next"} |= "level=error" [5m]) / count_over_time({title="martian-2", second="next-2"}[5m]))) by(job) * 100.000000)',
        expected: {
          selectorMatchers: [
            { label: 'title', operator: '=', value: '"martian"' },
            { label: 'second', operator: '=', value: '"next"' },
          ],
          pipeline: [
            {
              operator: '|=',
              value: '"level=error"',
            },
          ],
        },
      },
      {
        query: '{ log_type =~ ".+" } | json | line_format "{{.message}}"',
        expected: {
          selectorMatchers: [{ label: 'log_type', operator: '=~', value: '".+"' }],
          pipeline: [
            {
              operator: '|',
              value: 'json',
            },
            {
              operator: '|',
              value: 'line_format "{{.message}}"',
            },
          ],
        },
      },
      {
        query: '{ log_type =~ ".+" } | json | pattern `<_>:"<mytimestamp>",<_>`',
        expected: {
          selectorMatchers: [{ label: 'log_type', operator: '=~', value: '".+"' }],
          pipeline: [
            {
              operator: '|',
              value: 'json',
            },
            {
              operator: '|',
              value: 'pattern `<_>:"<mytimestamp>",<_>`',
            },
          ],
        },
      },
      {
        query: '{ log_type =~ ".+" } | unknown',
        expected: {
          selectorMatchers: [{ label: 'log_type', operator: '=~', value: '".+"' }],
          pipeline: [
            {
              operator: '|',
              value: 'unknown',
              labelsInFilter: [
                {
                  label: 'unknown',
                },
              ],
            },
          ],
        },
      },
      {
        query: '{ log_type =~ ".+" } | ',
        expected: {
          selectorMatchers: [{ label: 'log_type', operator: '=~', value: '".+"' }],
          pipeline: [
            {
              operator: '|',
              value: undefined,
            },
          ],
        },
      },
      {
        query:
          '{ log_type=~".+" } | json | level="unknown" or level="" != "tekton" |= "TLS handshake error from 10." != "10.128"',
        expected: {
          selectorMatchers: [{ label: 'log_type', operator: '=~', value: '".+"' }],
          pipeline: [
            {
              operator: '|',
              value: 'json',
              labelsInFilter: undefined,
            },
            {
              operator: '|',
              value: 'level="unknown" or level=""',
              labelsInFilter: [
                {
                  label: 'level',
                  operator: '=',
                  value: '"unknown"',
                },
                {
                  label: 'level',
                  operator: '=',
                  value: '""',
                },
              ],
            },
            {
              operator: '!=',
              value: '"tekton"',
            },
            {
              operator: '|=',
              value: '"TLS handshake error from 10."',
            },
            {
              operator: '!=',
              value: '"10.128"',
            },
          ],
        },
      },
    ].forEach(({ query, expected }) => {
      const logql = new LogQLQuery(query);
      expect(logql.streamSelector).toEqual(expected.selectorMatchers);
      expect(logql.pipeline).toEqual(expected.pipeline);
    });
  });

  it('should append a new selector', () => {
    [
      {
        query: '',
        selectorMatcher: { label: 'foo', operator: '=', value: '"var"' },
        expected: '{ foo="var" }',
      },
      {
        query: '{}',
        selectorMatcher: { label: 'foo', operator: '=', value: '"var"' },
        expected: '{ foo="var" }',
      },
      {
        query: '',
        selectorMatcher: { label: 'foo', operator: '=', value: '"var"' },
        expected: '{ foo="var" }',
      },
      {
        query: '{foo="var"}',
        selectorMatcher: { label: 'baz', operator: '=~', value: '"zad"' },
        expected: '{ foo="var", baz=~"zad" }',
      },
      {
        query: '{foo="var", baz=~"zad"}',
        selectorMatcher: { label: 'foo', operator: '=', value: '"var"' },
        expected: '{ foo="var", baz=~"zad" }',
      },
      {
        query: '{foo="var", baz=~"zad"}',
        selectorMatcher: { label: 'foo', operator: '=~', value: '"var|zad"' },
        expected: '{ foo=~"var|zad", baz=~"zad" }',
      },
    ].forEach(({ query, selectorMatcher, expected }) => {
      const logql = new LogQLQuery(query);
      expect(logql.addSelectorMatcher(selectorMatcher).toString()).toEqual(expected);
    });
  });

  it('should remove an existig selector', () => {
    [
      {
        query: '{foo="var"}',
        selectorMatcher: { label: 'foo' },
        expected: '',
      },
      {
        query: '{foo="var", baz=~"zad"}',
        selectorMatcher: { label: 'foo', operator: '=', value: '"var"' },
        expected: '{ baz=~"zad" }',
      },
      {
        query: '{foo="var", baz=~"zad"}',
        selectorMatcher: { label: 'fooo' },
        expected: '{ foo="var", baz=~"zad" }',
      },
    ].forEach(({ query, selectorMatcher, expected }) => {
      const logql = new LogQLQuery(query);
      expect(logql.removeSelectorMatcher(selectorMatcher).toString()).toEqual(expected);
    });
  });

  it('should append a new pipeline stage', () => {
    [
      {
        query: '',
        pipeline: { operator: '|', value: 'json' },
        expected: '', // If there's no stream selector a pipeline stage cannot be added
      },
      {
        query: '{ foo="var" }',
        pipeline: { operator: '|', value: 'json' },
        expected: '{ foo="var" } | json',
      },
      {
        query: '{ foo="var" }| json',
        pipeline: { operator: '|', value: 'level="err|error"' },
        expected: '{ foo="var" } | json | level="err|error"',
      },
      // Should not add a pipeline stage if already present
      {
        query: '{ foo="var" } | json',
        pipeline: { operator: '|', value: 'json' },
        expected: '{ foo="var" } | json',
      },
      {
        query: '{ foo="var" }| json | level="err|error"',
        pipeline: { operator: '|', value: 'level="err|error"' },
        expected: '{ foo="var" } | json | level="err|error"',
      },
    ].forEach(({ query, pipeline, expected }) => {
      const logql = new LogQLQuery(query);
      expect(logql.addPipelineStage(pipeline, { placement: 'end' }).toString()).toEqual(expected);
    });
  });

  it('should prepend a pipeline stage', () => {
    [
      {
        query: '{ foo="var" }',
        pipeline: { operator: '|', value: 'json' },
        expected: '{ foo="var" } | json',
      },
      {
        query: '{ foo="var" } | json',
        pipeline: { operator: '|', value: 'json' },
        expected: '{ foo="var" } | json',
      },
      {
        query: '{ foo="var" }| json',
        pipeline: { operator: '|', value: 'level="err|error"' },
        expected: '{ foo="var" } | level="err|error" | json',
      },
      {
        query: '{ foo="var" } | json',
        pipeline: [
          { operator: '|=', value: '"match this text"' },
          { operator: '|', value: 'level="err|error"' },
        ],
        expected: '{ foo="var" } |= "match this text" | level="err|error" | json',
      },
    ].forEach(({ query, pipeline, expected }) => {
      const logql = new LogQLQuery(query);
      expect(logql.addPipelineStage(pipeline, { placement: 'start' }).toString()).toEqual(expected);
    });
  });

  it('should remove a pipeline stage', () => {
    [
      {
        query: '{ foo="var" }',
        pipeline: { operator: '|' },
        expected: '{ foo="var" }',
      },
      {
        query: '{ foo="var" } | json | level="err|error"',
        pipeline: { operator: '|' },
        expected: '{ foo="var" }',
      },
      {
        query: '{ foo="var" } | json | level="err|error"',
        pipeline: { value: 'json' },
        expected: '{ foo="var" } | level="err|error"',
      },
      {
        query: '{ foo="var" } | json | level="err|error"',
        pipeline: {},
        matchOptions: { matchLabel: 'level' },
        expected: '{ foo="var" } | json',
      },
      {
        query: '{ foo="var" } | json | level="err|error"',
        pipeline: {},
        matchOptions: { matchLabel: 'no-match-label' },
        expected: '{ foo="var" } | json | level="err|error"',
      },
      {
        query: '{ foo="var" } |= "line search" | json',
        pipeline: { operator: '|=' },
        matchOptions: { matchLabel: 'non-match-label' },
        expected: '{ foo="var" } | json',
      },
      {
        query: '{ foo="var" } | json |= "line search"',
        pipeline: { operator: '|', value: 'non-match-value' },
        expected: '{ foo="var" } |= "line search"',
      },
      {
        query: '{ foo="var" } | json |= "line search"',
        pipeline: { value: 'json', operator: 'non-match-operator' },
        expected: '{ foo="var" } |= "line search"',
      },
    ].forEach(({ query, pipeline, expected, matchOptions }) => {
      const logql = new LogQLQuery(query);
      expect(logql.removePipelineStage(pipeline, matchOptions).toString()).toEqual(expected);
    });
  });

  it('should not change the string representation of a query', () => {
    [
      {
        query: 'max_over_time({ logs_type=~".+" }[10m]))',
        expected: 'max_over_time({ logs_type=~".+" }[10m]))',
      },
      {
        query: '{ foo="var" } |= "line search" | json',
        expected: '{ foo="var" } |= "line search" | json',
      },
      {
        query: '{ foo= } |= "line search" | json',
        expected: '{ foo= } |= "line search" | json',
      },
      {
        query: '{ foo="bar" } | json "line search"',
        expected: '{ foo="bar" } | json "line search"',
      },
      {
        query: '{ foo } |= "line search" | json',
        expected: '{ foo } |= "line search" | json',
      },
      {
        query: '{ foo="var" } | unknown',
        expected: '{ foo="var" } | unknown',
      },
      {
        query: '{ foo="var" } | ',
        expected: '{ foo="var" } | ',
      },
      {
        query: '{ foo="var" } |= ',
        expected: '{ foo="var" } |= ',
      },
      {
        query: '1 + 1',
        expected: '1 + 1',
      },
      {
        query:
          '(sum((count_over_time({title="martian", second="next"} |= "level=error" [5m]) / count_over_time({title="martian-2", second="next-2"}[5m]))) by(job) * 100.000000)',
        expected:
          '(sum((count_over_time({ title="martian", second="next" } |= "level=error" [5m]) / count_over_time({title="martian-2", second="next-2"}[5m]))) by(job) * 100.000000)',
      },
      {
        query:
          'sum by (level) (count_over_time({ log_type =~ ".+" } | json | level="unknown" or level="" or level=~"emerg|fatal|alert|crit|critical|err|error|eror|warn|warning|inf|info|information|notice" [1m]))',
        expected:
          'sum by (level) (count_over_time({ log_type=~".+" } | json | level="unknown" or level="" or level=~"emerg|fatal|alert|crit|critical|err|error|eror|warn|warning|inf|info|information|notice" [1m]))',
      },
      {
        query:
          '{ log_type=~".+" } != "tekton" |= "TLS handshake error from 10." | json != "10.128"',
        expected:
          '{ log_type=~".+" } != "tekton" |= "TLS handshake error from 10." != "10.128" | json',
      },
      {
        query:
          '{ log_type=~".+" } | json | level="unknown" or level="" != "tekton" |= "TLS handshake error from 10." !~ "10.128" |~ "10.128"',
        expected:
          '{ log_type=~".+" } != "tekton" |= "TLS handshake error from 10." !~ "10.128" |~ "10.128" | json | level="unknown" or level=""',
      },
      {
        query: '{ app="foobar" } |> "I <_>" | json',
        expected: '{ app="foobar" } |> "I <_>" | json',
      },
      {
        query: '{ app="foobar" } !> "I <_>" | json',
        expected: '{ app="foobar" } !> "I <_>" | json',
      },
      {
        query: '{ app="x" } | line_format "{{.message}}" |= "error"',
        expected: '{ app="x" } | line_format "{{.message}}" |= "error"',
      },
    ].forEach(({ query, expected }) => {
      const logql = new LogQLQuery(query);
      expect(logql.toString()).toEqual(expected);
    });
  });
});
