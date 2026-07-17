import path from 'node:path';
import type { Rule } from 'eslint';

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CAMEL_USE = /^use[A-Z][a-zA-Z0-9]*$/;

export const fileNaming: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce file naming conventions (.tsx = PascalCase, .ts = kebab-case or useXxx)',
    },
    schema: [],
    messages: {
      invalidTsxName:
        'TSX file "{{name}}" must use PascalCase (e.g. MyComponent.tsx) or camelCase with a "use" prefix for hooks (e.g. useMyHook.tsx).',
      invalidTsName:
        'TS file "{{name}}" must use kebab-case (e.g. my-utils.ts) or camelCase with a "use" prefix for hooks (e.g. useMyHook.ts).',
    },
  },
  create(context) {
    const filename = context.getFilename();
    const ext = path.extname(filename);
    const stem = path.basename(filename, ext);
    // Strip spec/test suffix before checking
    const baseStem = stem.replace(/\.(spec|test)$/, '');

    if (ext === '.tsx') {
      if (!PASCAL_CASE.test(baseStem) && !CAMEL_USE.test(baseStem)) {
        context.report({
          loc: { line: 1, column: 0 },
          messageId: 'invalidTsxName',
          data: { name: path.basename(filename) },
        });
      }
    } else if (ext === '.ts') {
      const valid = KEBAB_CASE.test(baseStem) || CAMEL_USE.test(baseStem);
      if (!valid) {
        context.report({
          loc: { line: 1, column: 0 },
          messageId: 'invalidTsName',
          data: { name: path.basename(filename) },
        });
      }
    }
    return {};
  },
};
