import * as React from 'react';
import { default as classNames } from 'classnames';
import { ProjectModel } from '../../../console/models';
import {
  k8sGet,
  useActiveNamespace,
  useActivePerspective,
} from '@openshift-console/dynamic-plugin-sdk';
import { KEYBOARD_SHORTCUTS, LEGACY_DASHBOARDS_KEY } from './utils/utils';
import ProjectDropdown from './ProjectDropdown';
import { setQueryArgument } from '../../../console/utils/router';
import { useQueryParams } from '../../../hooks/useQueryParams';

export type ProjectBarDropdownsProps = {
  children: React.ReactNode;
  isDisabled: boolean;
  onProjectChange: (project: string) => void;
};

export const ProjectBarDropdowns: React.FC<ProjectBarDropdownsProps> = ({
  children,
  isDisabled,
  onProjectChange,
}) => {
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const activePerspective = useActivePerspective()[0];
  const [activeNamespaceError, setActiveNamespaceError] = React.useState(false);
  const queryParams = useQueryParams();

  /* Check if the activeNamespace is present in the cluster */
  React.useEffect(() => {
    if (activeNamespace !== LEGACY_DASHBOARDS_KEY) {
      k8sGet({ model: ProjectModel })
        .then(() => {
          setActiveNamespace(activeNamespace);
          setQueryArgument('namespace', activeNamespace);
          setActiveNamespaceError(false);
        })
        .catch((err) => {
          if (err?.response?.status === 404) {
            /* This would redirect to "/all-namespaces" to show the Project List */
            setActiveNamespace(LEGACY_DASHBOARDS_KEY);
            setQueryArgument('namespace', LEGACY_DASHBOARDS_KEY);
            setActiveNamespaceError(true);
          }
        });
    } else {
      setActiveNamespace(LEGACY_DASHBOARDS_KEY);
      setQueryArgument('namespace', LEGACY_DASHBOARDS_KEY);
      setActiveNamespaceError(false);
    }
  }, [activeNamespace, activePerspective, setActiveNamespace, activeNamespaceError, queryParams]);

  return (
    <div className="co-project-bar__items" data-test-id="project-bar-dropdown">
      <ProjectDropdown
        onSelect={(event, newNamespace) => {
          onProjectChange?.(newNamespace);
          setActiveNamespace(newNamespace);
          setQueryArgument('namespace', newNamespace);
        }}
        selected={!activeNamespaceError ? activeNamespace : LEGACY_DASHBOARDS_KEY}
        disabled={isDisabled}
        shortCut={KEYBOARD_SHORTCUTS.focusNamespaceDropdown}
      />
      {children}
    </div>
  );
};

export const ProjectBar: React.FC<ProjectBarProps & { hideProjects?: boolean }> = ({
  onProjectChange,
  isDisabled,
  children,
  hideProjects = false,
}) => {
  return (
    <div
      className={classNames('co-project-bar', {
        'co-project-bar--no-project': hideProjects,
      })}
    >
      {hideProjects ? (
        <div className="co-project-bar__items" data-test-id="project-bar-dropdown">
          {children}
        </div>
      ) : (
        <ProjectBarDropdowns isDisabled={isDisabled} onProjectChange={onProjectChange}>
          {children}
        </ProjectBarDropdowns>
      )}
    </div>
  );
};

export type ProjectBarProps = {
  onProjectChange?: (project: string) => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
};

// Flag detection is not complete if the flag's value is `undefined`.
export const flagPending = (flag: boolean) => flag === undefined;
