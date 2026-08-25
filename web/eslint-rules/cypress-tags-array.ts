import type { Rule } from 'eslint';
import type { Property } from 'estree';
import { isTagsInCallOptions, isTagsProperty } from './cypress-tags-helper';

export const cypressTagsArray: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require Cypress tags to be declared as an array, even for a single tag',
    },
    schema: [],
    messages: {
      tagsMustBeArray: 'Cypress tags must be declared as an array (e.g. tags: [{{value}}]).',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Property(node: Property) {
        if (
          !isTagsProperty(node) ||
          !isTagsInCallOptions(node) ||
          node.value.type === 'ArrayExpression'
        ) {
          return;
        }
        const valueText = sourceCode.getText(node.value);
        context.report({
          node: node.value,
          messageId: 'tagsMustBeArray',
          data: { value: valueText },
          fix(fixer) {
            return fixer.replaceText(node.value, `[${valueText}]`);
          },
        });
      },
    };
  },
};
