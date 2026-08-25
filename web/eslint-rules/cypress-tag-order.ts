import type { Rule } from 'eslint';
import type { ArrayExpression, Property } from 'estree';
import { HIGH_LEVEL_COMPONENT_TAGS, MODIFIER_TAGS } from '../cypress/support/test-tags';
import { isTagsInCallOptions, isTagsProperty } from './cypress-tags-helper';

const MODIFIER_SET: ReadonlySet<string> = new Set(MODIFIER_TAGS);
const FEATURE_SET: ReadonlySet<string> = new Set(HIGH_LEVEL_COMPONENT_TAGS);
const SPECIFIC_FEATURE_RE = /^@[^\s-]+-[^\s]+$/;

export type TagKind = 'feature' | 'modifier' | 'unknown';

export function classifyTag(tag: string): TagKind {
  if (MODIFIER_SET.has(tag)) {
    return 'modifier';
  }
  if (FEATURE_SET.has(tag) || SPECIFIC_FEATURE_RE.test(tag)) {
    return 'feature';
  }
  return 'unknown';
}

export function sortTags(tags: string[]): string[] {
  const features = tags.filter((t) => classifyTag(t) === 'feature').sort();
  const modifiers = tags.filter((t) => classifyTag(t) === 'modifier').sort();
  const unknowns = tags.filter((t) => classifyTag(t) === 'unknown');
  return [...features, ...modifiers, ...unknowns];
}

export const cypressTagOrder: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Sort Cypress tags: feature tags alphabetically, then modifier tags alphabetically',
    },
    schema: [],
    messages: {
      unknownTag: "Tag '{{tag}}' is not a recognized tag. See cypress/support/test-tags.ts.",
      tagsNotSorted:
        'Cypress tags must be sorted: feature tags alphabetically, then modifier tags ' +
        'alphabetically. Expected: [{{expected}}].',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Property(node: Property) {
        if (
          !isTagsProperty(node) ||
          !isTagsInCallOptions(node) ||
          node.value.type !== 'ArrayExpression'
        ) {
          return;
        }
        const array = node.value as ArrayExpression;
        const elements = array.elements;

        const stringElements = elements.filter(
          (el): el is ArrayExpression['elements'][number] & { type: 'Literal' } =>
            el != null && el.type === 'Literal' && typeof el.value === 'string',
        );
        if (stringElements.length !== elements.length || stringElements.length === 0) {
          return;
        }

        const tags = stringElements.map((el) => String((el as { value: string }).value));

        for (const [index, tag] of tags.entries()) {
          if (classifyTag(tag) === 'unknown') {
            context.report({
              node: stringElements[index],
              messageId: 'unknownTag',
              data: { tag },
            });
          }
        }

        const sorted = sortTags(tags);
        if (tags.some((tag, i) => tag !== sorted[i])) {
          context.report({
            node: array,
            messageId: 'tagsNotSorted',
            data: { expected: sorted.map((t) => `'${t}'`).join(', ') },
            fix(fixer) {
              const rawByTag = new Map<string, string>();
              stringElements.forEach((el, i) => {
                rawByTag.set(tags[i], sourceCode.getText(el));
              });
              const used = new Map<string, number>();
              const newText = sorted
                .map((tag) => {
                  const count = used.get(tag) ?? 0;
                  used.set(tag, count + 1);
                  return rawByTag.get(tag) ?? `'${tag}'`;
                })
                .join(', ');
              return fixer.replaceText(array, `[${newText}]`);
            },
          });
        }
      },
    };
  },
};
