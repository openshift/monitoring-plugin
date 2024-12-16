export const SYSTEM_NAMESPACES_PREFIX = ['kube-', 'openshift-', 'kubernetes-'];
export const SYSTEM_NAMESPACES = ['default', 'openshift'];

export const isSystemNamespace = (option: { title: string; key?: string }) => {
  const startsWithNamespace = SYSTEM_NAMESPACES_PREFIX.some((ns) => option.title?.startsWith(ns));
  const isNamespace = SYSTEM_NAMESPACES.includes(option.title);

  return startsWithNamespace || isNamespace;
};
