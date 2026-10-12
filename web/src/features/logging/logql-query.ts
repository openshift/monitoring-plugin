import { parser } from '@grafana/lezer-logql';
import { SyntaxNodeRef, Tree } from '@lezer/common';

export type LabelMatcher = {
  label?: string;
  operator?: string;
  value?: string;
};
export type PipelineStage = {
  operator?: string;
  value?: string;
  labelsInFilter?: Array<LabelMatcher>;
};

type ExpressionBounds = { from: number; to: number };

const parseMatchers = (
  syntaxTree: Tree,
  node: SyntaxNodeRef,
  query: string,
): Array<LabelMatcher> => {
  const matchers: Array<LabelMatcher> = [];
  let label: string, operator: string, value: string;

  syntaxTree.iterate({
    from: node.from,
    to: node.to,
    enter(selectorsNode) {
      if (selectorsNode.name === 'Identifier') {
        label = query.slice(selectorsNode.from, selectorsNode.to);

        return false;
      } else if (['Eq', 'Neq', 'Re', 'Nre'].includes(selectorsNode.name)) {
        operator = query.slice(selectorsNode.from, selectorsNode.to);

        return false;
      } else if (selectorsNode.name === 'String') {
        value = query.slice(selectorsNode.from, selectorsNode.to);

        return false;
      }
    },
    leave(selectorsNode) {
      if (selectorsNode.name === 'Matcher') {
        matchers.push({ label, operator, value });
      }
    },
  });

  return matchers;
};

const parseLineFilters = (
  syntaxTree: Tree,
  node: SyntaxNodeRef,
  query: string,
): Array<PipelineStage> => {
  const lineFilters: Array<PipelineStage> = [];
  let operator: string, value: string;

  syntaxTree.iterate({
    from: node.from,
    to: node.to,
    enter(selectorsNode) {
      if (
        ['PipeExact', 'PipeMatch', 'PipePattern', 'Npa', 'Eq', 'Neq', 'Re', 'Nre'].includes(
          selectorsNode.name,
        )
      ) {
        operator = query.slice(selectorsNode.from, selectorsNode.to);

        return false;
      } else if (selectorsNode.name === 'String') {
        value = query.slice(selectorsNode.from, selectorsNode.to);

        return false;
      }
    },
    leave(selectorsNode) {
      if (selectorsNode.name === 'LineFilter') {
        lineFilters.push({ operator, value });
      }
    },
  });

  return lineFilters;
};

const parsePipelineStages = (
  syntaxTree: Tree,
  node: SyntaxNodeRef,
  query: string,
): Array<PipelineStage> => {
  const pipelineStages: Array<PipelineStage> = [];
  let operator: string, value: string, labelsInFilter: Array<LabelMatcher> | undefined;
  let lineFilters: Array<PipelineStage> = [];

  syntaxTree.iterate({
    from: node.from,
    to: node.to,
    enter(selectorsNode) {
      if (
        ['Pipe', 'PipeExact', 'PipeMatch', 'Eq', 'Neq', 'Re', 'Nre'].includes(selectorsNode.name)
      ) {
        operator = query.slice(selectorsNode.from, selectorsNode.to);

        return false;
      } else if (
        [
          'LabelParser',
          'JsonExpressionParser',
          'LabelFilter',
          'LineFormatExpr',
          'LineFilters',
          'LabelFormatExpr',
          'String',
        ].includes(selectorsNode.name)
      ) {
        value = query.slice(selectorsNode.from, selectorsNode.to);

        if (selectorsNode.name === 'LabelFilter') {
          labelsInFilter = parseMatchers(syntaxTree, selectorsNode, query);
        } else if (selectorsNode.name === 'LineFilters') {
          lineFilters = parseLineFilters(syntaxTree, selectorsNode, query);
        }

        return false;
      }
    },
    leave(selectorsNode) {
      if (selectorsNode.name === 'PipelineStage') {
        if (lineFilters.length > 0) {
          pipelineStages.push(...lineFilters);
        } else {
          pipelineStages.push({ operator, value, labelsInFilter });
        }
      }
      labelsInFilter = undefined;
      lineFilters = [];
    },
  });

  return pipelineStages;
};

// place line filters first for better performance
const operatorSort = (a: PipelineStage, b: PipelineStage) => {
  const lineFilterOperators = ['|=', '!=', '|~', '!~'];

  if (
    lineFilterOperators.includes(a.operator ?? '') &&
    !lineFilterOperators.includes(b.operator ?? '')
  ) {
    return -1;
  } else if (
    !lineFilterOperators.includes(a.operator ?? '') &&
    lineFilterOperators.includes(b.operator ?? '')
  ) {
    return 1;
  }

  return 0;
};

const isLineTransformStage = (stage: PipelineStage): boolean => {
  return stage.value?.startsWith('line_format') ?? false;
};

const sortPipelineWithBoundaries = (pipeline: Array<PipelineStage>): Array<PipelineStage> => {
  const result: Array<PipelineStage> = [];
  let segment: Array<PipelineStage> = [];

  for (const stage of pipeline) {
    if (isLineTransformStage(stage)) {
      result.push(...segment.sort(operatorSort));
      result.push(stage);
      segment = [];
    } else {
      segment.push(stage);
    }
  }

  result.push(...segment.sort(operatorSort));

  return result;
};

export class LogQLQuery {
  streamSelector: Array<LabelMatcher> = [];
  streamSelectors: Array<Array<LabelMatcher>> = [];
  pipeline: Array<PipelineStage> = [];
  streamSelectorBounds: ExpressionBounds | undefined = undefined;
  pipelineBounds: ExpressionBounds | undefined = undefined;
  originalQuery = '';

  constructor(query: string) {
    const syntaxTree = parser.parse(query);
    const parsedSelectors: Array<Array<LabelMatcher>> = [];
    let parsedPipeline: Array<PipelineStage> = [];

    let parsedMatcherBounds: ExpressionBounds | undefined = undefined;
    let parsedPipelineBounds: ExpressionBounds | undefined = undefined;

    syntaxTree.iterate({
      enter(node) {
        if (node.name === 'Selector') {
          if (parsedSelectors.length === 0) {
            parsedMatcherBounds = { from: node.from, to: node.to };
          }
          parsedSelectors.push(parseMatchers(syntaxTree, node, query));

          return false;
        } else if (node.name === 'PipelineExpr' && parsedPipeline.length === 0) {
          parsedPipeline = parsePipelineStages(syntaxTree, node, query);

          parsedPipelineBounds = { from: node.from, to: node.to };

          return false;
        }
      },
    });

    this.streamSelector = parsedSelectors[0] ?? [];
    this.streamSelectors = parsedSelectors;
    this.pipeline = parsedPipeline;
    this.streamSelectorBounds = parsedMatcherBounds;
    this.pipelineBounds = parsedPipelineBounds;
    this.originalQuery = query;
  }

  removeSelectorMatcher = (matcherToRemove: Partial<LabelMatcher>) => {
    this.streamSelector = this.streamSelector.filter(
      (matcher) => !matcherToRemove.label || matcher.label !== matcherToRemove.label,
    );

    return this;
  };

  addSelectorMatcher = (matchers?: LabelMatcher | Array<LabelMatcher>) => {
    if (!matchers) {
      return this;
    }

    const matchersArray = Array.isArray(matchers) ? matchers : [matchers];

    matchersArray.forEach((matcher) => {
      const existingSelectorIndex = this.streamSelector.findIndex(
        ({ label }) => matcher.label === label,
      );

      if (existingSelectorIndex !== -1) {
        this.streamSelector[existingSelectorIndex] = matcher;
      } else {
        this.streamSelector.push(matcher);
      }
    });

    return this;
  };

  removePipelineStage = (
    pipelineStageToRemove: Partial<PipelineStage>,
    matchOptions?: { matchLabel?: string },
  ) => {
    this.pipeline = this.pipeline.filter((existingStage) => {
      if (
        pipelineStageToRemove.operator &&
        existingStage.operator === pipelineStageToRemove.operator
      ) {
        return false;
      }

      if (pipelineStageToRemove.value && existingStage.value === pipelineStageToRemove.value) {
        return false;
      }

      if (
        matchOptions?.matchLabel &&
        existingStage.labelsInFilter?.every((label) => label.label === matchOptions.matchLabel)
      ) {
        return false;
      }

      return true;
    });

    return this;
  };

  addPipelineStage = (
    newPipelineStage?: PipelineStage | Array<PipelineStage>,
    options?: { placement?: 'start' | 'end' },
  ) => {
    const placement = options?.placement ?? 'start';

    if (!newPipelineStage) {
      return this;
    }

    const stagesArray = Array.isArray(newPipelineStage) ? newPipelineStage : [newPipelineStage];

    if (placement === 'start') {
      this.pipeline.unshift(...stagesArray);
    } else {
      this.pipeline.push(...stagesArray);
    }

    this.pipeline = this.pipeline.filter(
      (stage, index) =>
        this.pipeline.findIndex(
          (existingStage) =>
            stage.operator === existingStage.operator && stage.value === existingStage.value,
        ) === index,
    );

    return this;
  };

  toString = () => {
    let query = '';

    const minIndex = Math.min(
      this.streamSelectorBounds ? this.streamSelectorBounds.from : Number.MAX_SAFE_INTEGER,
      this.pipelineBounds ? this.pipelineBounds.from : Number.MAX_SAFE_INTEGER,
    );

    query += minIndex != Number.MAX_SAFE_INTEGER ? this.originalQuery.slice(0, minIndex) : '';

    const stream =
      this.streamSelector.length > 0
        ? `{ ${this.streamSelector
            .map(
              ({ label, operator, value }) =>
                `${label}${operator !== undefined ? operator : ''}${
                  value !== undefined ? value : ''
                }`,
            )
            .join(', ')} }`
        : '';

    const pipeline =
      this.streamSelector.length > 0
        ? `${sortPipelineWithBoundaries(this.pipeline)
            .map(({ operator, value }) => ` ${operator} ${value !== undefined ? value : ''}`)
            .join('')}`
        : '';

    query += stream + pipeline;

    query += this.originalQuery.slice(
      Math.max(
        this.streamSelectorBounds ? this.streamSelectorBounds.to : 0,
        this.pipelineBounds ? this.pipelineBounds.to : 0,
      ),
    );

    return query;
  };
}
