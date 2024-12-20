import * as React from 'react';
import { default as classNames } from 'classnames';
import { KEYBOARD_SHORTCUTS } from './utils';
import ProjectDropdown from './ProjectDropdown';
import { useActiveProject } from './useActiveProject';

export type ProjectBarDropdownsProps = {
  children: React.ReactNode;
  isDisabled: boolean;
};

export const ProjectBarDropdowns: React.FC<ProjectBarDropdownsProps> = ({
  children,
  isDisabled,
}) => {
  const { activeProject, setActiveProject } = useActiveProject();
  return (
    <div className="co-project-bar__items" data-test-id="project-bar-dropdown">
      <ProjectDropdown
        onSelect={(event, newProject) => {
          console.log('setting new project: ', newProject);
          setActiveProject(newProject);
        }}
        selected={activeProject}
        disabled={isDisabled}
        shortCut={KEYBOARD_SHORTCUTS.focusNamespaceDropdown}
      />
      {children}
    </div>
  );
};

export const ProjectBar: React.FC<ProjectBarProps & { hideProjects?: boolean }> = ({
  isDisabled,
  children,
}) => {
  return (
    <div className={classNames('co-project-bar')}>
      <ProjectBarDropdowns isDisabled={isDisabled}>{children}</ProjectBarDropdowns>
    </div>
  );
};

export type ProjectBarProps = {
  isDisabled?: boolean;
  children?: React.ReactNode;
};

// Flag detection is not complete if the flag's value is `undefined`.
export const flagPending = (flag: boolean) => flag === undefined;
