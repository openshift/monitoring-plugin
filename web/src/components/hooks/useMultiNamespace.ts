import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  K8sResourceKind,
  useActiveNamespace,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { ALL_NAMESPACES_KEY } from '../utils';
import { ProjectModel } from '../console/models';

/**
 * Hook to manage multi-namespace selection for the monitoring plugin.
 * Returns the list of accessible namespaces, selected namespaces, and a setter.
 * When "All Namespaces" is toggled, all accessible namespaces are selected.
 */
export const useMultiNamespace = () => {
  const [activeNamespace] = useActiveNamespace();

  const [namespaceResources] = useK8sWatchResource<K8sResourceKind[]>({
    kind: ProjectModel.kind,
    isList: true,
    optional: true,
  });

  const accessibleNamespaces = useMemo(
    () =>
      (namespaceResources || [])
        .map((ns) => ns.metadata?.name)
        .filter(Boolean)
        .sort() as string[],
    [namespaceResources],
  );

  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const [allSelected, setAllSelected] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (
      !isInitialized.current &&
      activeNamespace &&
      activeNamespace !== ALL_NAMESPACES_KEY &&
      selectedNamespaces.length === 0
    ) {
      setSelectedNamespaces([activeNamespace]);
      isInitialized.current = true;
    }
  }, [activeNamespace]);

  const toggleNamespace = useCallback((ns: string) => {
    setAllSelected(false);
    setSelectedNamespaces((prev) =>
      prev.includes(ns) ? prev.filter((n) => n !== ns) : [...prev, ns],
    );
  }, []);

  const selectAll = useCallback(() => {
    setAllSelected(true);
    setSelectedNamespaces(accessibleNamespaces);
  }, [accessibleNamespaces]);

  const deselectAll = useCallback(() => {
    setAllSelected(false);
    setSelectedNamespaces([]);
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [allSelected, selectAll, deselectAll]);

  const namespaceForQuery = useMemo(() => {
    if (selectedNamespaces.length === 0) {
      return activeNamespace === ALL_NAMESPACES_KEY ? undefined : activeNamespace;
    }
    if (selectedNamespaces.length === 1) {
      return selectedNamespaces[0];
    }
    return selectedNamespaces;
  }, [selectedNamespaces, activeNamespace]);

  return {
    accessibleNamespaces,
    selectedNamespaces,
    allSelected,
    toggleNamespace,
    selectAll,
    deselectAll,
    toggleAll,
    setSelectedNamespaces,
    namespaceForQuery,
  };
};
