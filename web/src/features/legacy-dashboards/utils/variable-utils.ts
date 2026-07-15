import * as _ from 'lodash-es';
import { DEFAULT_GRAPH_SAMPLES, MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from './utils';
import { ALL_NAMESPACES_KEY } from '@shared/utils/utils';

const intervalVariableRegExps = ['__interval', '__rate_interval', '__auto_interval_[a-z]+'];

export const isIntervalVariable = (itemKey: string): boolean =>
  _.some(intervalVariableRegExps, (re) =>
    itemKey?.match(new RegExp(`\\$${re}(?![a-zA-Z0-9_])`, 'g')),
  );

export type Variable = {
  isHidden?: boolean;
  isLoading?: boolean;
  includeAll?: boolean;
  options?: string[];
  query?: string;
  value?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datasource?: any;
};

/*
 * Escapes a variable value if it is in a regex context (i.e., after =~ or !~ operators).
 * Backslashes are doubled because PromQL parses string literals using Go-style escape rules
 * before passing the result to RE2. A single \[ is not a valid Go escape and causes a parse
 * error; \\[ is parsed by Go as literal \ then [, giving RE2 the pattern \[ which matches
 * a literal bracket.
 */
const escapeIfRegexContext = (template: string, position: number, value: string): string => {
  const prefix = template.substring(0, position);
  if (/[!=]~"[^"]*$/.test(prefix)) {
    return _.escapeRegExp(value).replace(/\\/g, '\\\\');
  }
  return value;
};

export const evaluateVariableTemplate = (
  template: string,
  variables: Record<string, Variable>,
  timespan: number,
  namespace: string,
): string | undefined => {
  if (_.isEmpty(template)) {
    return undefined;
  }

  const allVariables = {
    ...variables,
    __range: { value: `${Math.floor(timespan / 1000)}s` } as Variable,
    __range_ms: { value: `${timespan}` } as Variable,
    __range_s: { value: `${Math.floor(timespan / 1000)}` } as Variable,
  };

  // Handle the special "interval" variables
  const intervalMS = timespan / DEFAULT_GRAPH_SAMPLES;
  const intervalMinutes = Math.floor(intervalMS / 1000 / 60);
  // Use a minimum of 5m to make sure we have enough data to perform `irate` calculations, which
  // require 2 data points each. Otherwise, there could be gaps in the graph.
  const interval: Variable = { value: `${Math.max(intervalMinutes, 5)}m` };
  // Add these last to ensure they are applied after other variable substitutions (because the other
  // variable substitutions may result in interval variables like $__interval being inserted)
  intervalVariableRegExps.forEach((k) => (allVariables[k] = interval));

  let result = template;
  _.each(allVariables, (v, k) => {
    const re = new RegExp(`\\$${k}(?![a-zA-Z0-9_])`, 'g');
    if (result.match(re)) {
      if (v.isLoading) {
        result = undefined;
        return false;
      }
      const isAllOption = v.value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY;
      let replacement = isAllOption ? '.+' : v.value || '';
      if (k === 'namespace' && namespace !== ALL_NAMESPACES_KEY) {
        replacement = namespace;
      }

      if (isAllOption) {
        result = result.replace(re, replacement);
      } else {
        result = result.replace(re, (_match, offset) =>
          escapeIfRegexContext(result, offset, replacement),
        );
      }
    }
  });

  return result;
};
