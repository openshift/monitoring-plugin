import path from 'node:path';
import type { Rule } from 'eslint';

/** Page files are `*Page.tsx` files inside a feature's `pages/` directory. */
const isPageFile = (filename: string): boolean =>
  filename.includes(`${path.sep}pages${path.sep}`) && /Page\.tsx$/.test(filename);

const endsInPage = (name: string): boolean => /Page$/.test(name);

type ExportDeclaration = {
  type: string;
  id?: { name?: string } | null;
  declarations?: Array<{ id: { type: string; name?: string } }>;
};

type NamedExportNode = Rule.Node & {
  exportKind?: 'value' | 'type';
  declaration?: ExportDeclaration;
  specifiers?: Array<{ exported: { name: string } }>;
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
    },
  },
  create(context) {
    if (!isPageFile(context.filename)) {
      return {};
    }

    const report = (node: Rule.Node, name: string) => {
      if (!endsInPage(name)) {
        context.report({
          node,
          messageId: 'invalidPageExport',
          data: { file: path.basename(context.filename), name },
        });
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
            for (const declarator of declaration.declarations) {
              if (declarator.id.type === 'Identifier') {
                report(node, declarator.id.name);
              }
            }
          }
          return;
        }
        for (const specifier of exportNode.specifiers ?? []) {
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
    };
  },
};
