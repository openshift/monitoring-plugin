import * as React from 'react';
import { default as classNames } from 'classnames';
import { ProjectModel } from '../../models';
import {
  k8sGet,
  useActiveNamespace,
  useActivePerspective,
  useFlag,
} from '@openshift-console/dynamic-plugin-sdk';
import { ALL_NAMESPACES_KEY, FLAGS, KEYBOARD_SHORTCUTS } from './utils/utils';
import NamespaceDropdown from './NamespaceDropdown';
import { setQueryArgument } from '../../utils/router';

export type NamespaceBarDropdownsProps = {
  children: React.ReactNode;
  isDisabled: boolean;
  onNamespaceChange: (namespace: string) => void;
};

export const NamespaceBarDropdowns: React.FC<NamespaceBarDropdownsProps> = ({
  children,
  isDisabled,
  onNamespaceChange,
}) => {
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const activePerspective = useActivePerspective()[0];
  const [activeNamespaceError, setActiveNamespaceError] = React.useState(false);
  const canListNS = useFlag(FLAGS.CAN_LIST_NS);

  /* Check if the activeNamespace is present in the cluster */
  React.useEffect(() => {
    if (activePerspective === 'dev' && activeNamespace !== ALL_NAMESPACES_KEY) {
      k8sGet({ model: ProjectModel, ns: activeNamespace })
        .then(() => {
          setActiveNamespace(activeNamespace);
          setActiveNamespaceError(false);
        })
        .catch((err) => {
          if (err?.response?.status === 404) {
            /* This would redirect to "/all-namespaces" to show the Project List */
            setActiveNamespace(ALL_NAMESPACES_KEY);
            setActiveNamespaceError(true);
          }
        });
    }
  }, [activeNamespace, activePerspective, setActiveNamespace, activeNamespaceError]);

  if (flagPending(canListNS)) {
    return null;
  }

  return (
    <div className="co-namespace-bar__items" data-test-id="namespace-bar-dropdown">
      <NamespaceDropdown
        onSelect={(event, newNamespace) => {
          onNamespaceChange?.(newNamespace);
          setActiveNamespace(newNamespace);
          setQueryArgument('namespace', newNamespace);
        }}
        selected={!activeNamespaceError ? activeNamespace : ALL_NAMESPACES_KEY}
        disabled={isDisabled}
        shortCut={KEYBOARD_SHORTCUTS.focusNamespaceDropdown}
      />
      {children}
    </div>
  );
};

export const NamespaceBar: React.FC<NamespaceBarProps & { hideProjects?: boolean }> = ({
  onNamespaceChange,
  isDisabled,
  children,
  hideProjects = false,
}) => {
  return (
    <div
      className={classNames('co-namespace-bar', {
        'co-namespace-bar--no-project': hideProjects,
      })}
    >
      {hideProjects ? (
        <div className="co-namespace-bar__items" data-test-id="namespace-bar-dropdown">
          {children}
        </div>
      ) : (
        <NamespaceBarDropdowns isDisabled={isDisabled} onNamespaceChange={onNamespaceChange}>
          {children}
        </NamespaceBarDropdowns>
      )}
    </div>
  );
};

export type NamespaceBarProps = {
  onNamespaceChange?: (namespace: string) => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
};

// Flag detection is not complete if the flag's value is `undefined`.
export const flagPending = (flag: boolean) => flag === undefined;
