import type { CallExpression, Expression, Node, Property, Super } from 'estree';

const SUPPORTED_CALLS: ReadonlySet<string> = new Set(['describe', 'it', 'context', 'specify']);

export function isTagsProperty(node: Property): boolean {
  const key = node.key;
  if (key.type === 'Identifier') {
    return key.name === 'tags';
  }
  if (key.type === 'Literal') {
    return key.value === 'tags';
  }
  return false;
}

function calleeName(callee: Expression | Super): string | undefined {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (callee.type === 'MemberExpression') {
    return calleeName(callee.object);
  }
  return undefined;
}

function isSupportedCall(node: CallExpression): boolean {
  const name = calleeName(node.callee);
  return name !== undefined && SUPPORTED_CALLS.has(name);
}

type WithParent = Node & { parent?: WithParent };

export function isTagsInCallOptions(node: Property): boolean {
  const objectExpression = (node as WithParent).parent;
  if (objectExpression?.type !== 'ObjectExpression') {
    return false;
  }
  const call = objectExpression.parent;
  if (call?.type !== 'CallExpression') {
    return false;
  }
  return call.arguments.includes(objectExpression as never) && isSupportedCall(call);
}
