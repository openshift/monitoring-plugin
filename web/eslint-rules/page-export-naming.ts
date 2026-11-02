import path from 'node:path';
import type { Rule } from 'eslint';

/** Page files are `*Page.tsx` files inside a feature's `pages/` directory. */
const isPageFile = (filename: string): boolean =>
  filename.includes(`${path.sep}pages${path.sep}`) && /Page\.tsx$/.test(filename);

const endsInPage = (name: string): boolean => /Page$/.test(name);

type ExportDeclaration = {
  type: string;
  id?: { name?: string } | null;
};

type NamedExportNode = Rule.Node & {
  exportKind?: 'value' | 'type';
  declaration?: ExportDeclaration;
  specifiers?: Array<{ exported: { name: string }; exportKind?: 'value' | 'type' }>;
};

type ExportAllNode = Rule.Node & {
  exportKind?: 'value' | 'type';
  exported?: { name: string } | null;
};

type DefaultExportNode = Rule.Node & { declaration: ExportDeclaration & { name?: string } };

export const pageExportNaming: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Page files (*Page.tsx) may only export components whose names end in "Page".',
    },
    schema: [],
    messages: {
      invalidPageExport:
        'Page file "{{file}}" must not export "{{name}}". Page files may only export ' +
        'components whose names end in "Page"; move shared components, helpers, and ' +
        'constants to a non-page module (e.g. components/, hooks/, or utils/).',
      noStarReexport:
        'Page file "{{file}}" must not use "export *"; its re-exported names cannot be ' +
        'verified to end in "Page". Re-export each *Page symbol explicitly instead.',
    },
  },
  create(context) {
    if (!isPageFile(context.filename)) {
      return {};
    }

    const file = path.basename(context.filename);

    const report = (node: Rule.Node, name: string) => {
      if (!endsInPage(name)) {
        context.report({ node, messageId: 'invalidPageExport', data: { file, name } });
      }
    };

    return {
      ExportNamedDeclaration(node: Rule.Node) {
        const exportNode = node as NamedExportNode;
        if (exportNode.exportKind === 'type') {
          return;
        }
        const declaration = exportNode.declaration;
        if (declaration) {
          if (
            declaration.type === 'FunctionDeclaration' ||
            declaration.type === 'ClassDeclaration'
          ) {
            if (declaration.id) {
              report(node, declaration.id.name);
            }
          } else if (declaration.type === 'VariableDeclaration') {
            // getDeclaredVariables resolves every binding the declaration
            // introduces, including destructured, default, and rest names.
            const declaredVariables = context.sourceCode.getDeclaredVariables(
              declaration as Parameters<typeof context.sourceCode.getDeclaredVariables>[0],
            );
            for (const variable of declaredVariables) {
              report(node, variable.name);
            }
          }
          return;
        }
        for (const specifier of exportNode.specifiers ?? []) {
          // Inline type specifiers (`export { type Foo }`) are type-only and exempt.
          if (specifier.exportKind === 'type') {
            continue;
          }
          report(node, specifier.exported.name);
        }
      },
      ExportDefaultDeclaration(node: Rule.Node) {
        const declaration = (node as DefaultExportNode).declaration;
        let name: string | undefined;
        if (declaration.type === 'Identifier') {
          name = declaration.name;
        } else if (
          declaration.type === 'FunctionDeclaration' ||
          declaration.type === 'ClassDeclaration'
        ) {
          name = declaration.id?.name;
        }
        // Anonymous default exports (e.g. inline arrow functions) cannot be
        // checked by name and are skipped.
        if (name) {
          report(node, name);
        }
      },
      ExportAllDeclaration(node: Rule.Node) {
        const exportNode = node as ExportAllNode;
        if (exportNode.exportKind === 'type') {
          return;
        }
        if (exportNode.exported) {
          // `export * as Name from '...'` has a checkable namespace name.
          report(node, exportNode.exported.name);
        } else {
          // `export * from '...'` re-exports unknown names that cannot be verified.
          context.report({ node, messageId: 'noStarReexport', data: { file } });
        }
      },
    };
  },
};
