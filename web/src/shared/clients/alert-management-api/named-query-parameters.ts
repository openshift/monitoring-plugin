import ts from 'typescript';

function callsQueryHook(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    /^use(Suspense)?(Infinite)?Query$/.test(node.expression.text)
  ) {
    return true;
  }
  return ts.forEachChild(node, callsQueryHook) ?? false;
}

// Group all query-hook arguments together
export function namedQueryParameters(implementation: string): string {
  const source = ts.createSourceFile('query.ts', implementation, ts.ScriptTarget.Latest, true);
  const hooks = source.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      /^use[A-Z]/.test(statement.name?.text ?? '') &&
      statement.body !== undefined &&
      callsQueryHook(statement.body),
  );

  // Work backwards so replacing one signature does not shift the next one's offsets.
  return hooks.reverse().reduce((result, hook) => {
    if (hook.parameters.length === 0) {
      return result;
    }
    const names: string[] = [];
    const properties = hook.parameters.map((parameter) => {
      if (
        !ts.isIdentifier(parameter.name) ||
        !parameter.type ||
        parameter.dotDotDotToken ||
        parameter.initializer
      ) {
        throw new Error(`Unsupported generated query-hook parameter: ${parameter.getText(source)}`);
      }
      names.push(parameter.name.text);
      return `${parameter.name.text}${parameter.questionToken ? '?' : ''}: ${parameter.type.getText(source)}`;
    });
    const defaultValue = hook.parameters.every((parameter) => parameter.questionToken)
      ? ' = {}'
      : '';
    const parameters = `{ ${names.join(', ')} }: { ${properties.join('; ')} }${defaultValue}`;
    return result.slice(0, hook.parameters.pos) + parameters + result.slice(hook.parameters.end);
  }, implementation);
}
