import ts from 'typescript';

import { namedQueryParameters } from '@/shared/clients/alert-management-api/named-query-parameters';

const parametersOf = (implementation: string) => {
  const source = ts.createSourceFile('query.ts', implementation, ts.ScriptTarget.Latest, true);
  return source.statements.filter(ts.isFunctionDeclaration).map((hook) => ({
    name: hook.name?.text,
    parameters: hook.parameters.map((parameter) => parameter.getText(source)),
  }));
};

it('groups optional params and options while preserving generic types and hook bodies', () => {
  const body = 'return useQuery(getQueryOptions(params, options));';
  const result = namedQueryParameters(`
    export function useGetRules<TData = Response>(
      params?: Params,
      options?: { query?: QueryOptions<TData> },
    ): QueryResult<TData> { ${body} }
  `);

  expect(parametersOf(result)).toEqual([
    {
      name: 'useGetRules',
      parameters: [
        '{ params, options }: { params?: Params; options?: { query?: QueryOptions<TData> } } = {}',
      ],
    },
  ]);
  expect(result).toContain('useGetRules<TData = Response>');
  expect(result).toContain(`: QueryResult<TData> { ${body} }`);
});

it('transforms multiple hooks without changing request functions', () => {
  const result = namedQueryParameters(`
    export function getRules(params?: Params) { return fetchRules(params); }
    export function useGetRules(params?: Params, options?: Options) {
      return useQuery(getQueryOptions(params, options));
    }
    export function useGetHealth(options?: Options) {
      return useQuery(getHealthQueryOptions(options));
    }
  `);

  expect(parametersOf(result)).toEqual([
    { name: 'getRules', parameters: ['params?: Params'] },
    {
      name: 'useGetRules',
      parameters: ['{ params, options }: { params?: Params; options?: Options } = {}'],
    },
    { name: 'useGetHealth', parameters: ['{ options }: { options?: Options } = {}'] },
  ]);
});

it('keeps required arguments required', () => {
  const result = namedQueryParameters(
    'export function useGetRule(id: string, options?: Options) { return useQuery(getQueryOptions(id, options)); }',
  );

  expect(parametersOf(result)[0].parameters).toEqual([
    '{ id, options }: { id: string; options?: Options }',
  ]);
});

it.each(['useQuery', 'useInfiniteQuery', 'useSuspenseQuery', 'useSuspenseInfiniteQuery'])(
  'transforms a POST-backed query using %s',
  (queryHook) => {
    const implementation = `
      export function useSearchRules(body: SearchRulesRequest, options?: Options) {
        const queryOptions = { queryFn: () => fetch('/rules/search', { method: 'POST', body }) };
        return ${queryHook}(queryOptions);
      }
    `;
    const result = namedQueryParameters(implementation);

    expect(parametersOf(result)[0].parameters).toEqual([
      '{ body, options }: { body: SearchRulesRequest; options?: Options }',
    ]);
    expect(result).toContain("method: 'POST'");
  },
);

it('leaves mutation hooks and other declarations unchanged', () => {
  const implementation = `
    export const useUpdateRule = (options?: Options) => useMutation(options);
    export function useDeleteRule(options?: Options) { return useMutation(options); }
    export function useRuleOptions(options?: Options) { return options; }
  `;
  expect(namedQueryParameters(implementation)).toBe(implementation);
});

it('fails generation rather than silently producing an invalid signature', () => {
  expect(() =>
    namedQueryParameters(
      'export function useGetRules({ params }: Args) { return useQuery(params); }',
    ),
  ).toThrow('Unsupported generated query-hook parameter');
});
