import * as React from 'react';
import { KEYBOARD_SHORTCUTS } from './utils';
import ProjectDropdown from './ProjectDropdown';
import { default as classNames } from 'classnames';

export type ProjectBarProps = {
  setActiveProject: React.Dispatch<React.SetStateAction<string>>;
  activeProject: string;
};

export const ProjectBar: React.FC<ProjectBarProps> = ({ setActiveProject, activeProject }) => {
  return (
    <div className={classNames('co-project-bar')}>
      <div className="co-project-bar__items" data-test-id="project-bar-dropdown">
        <ProjectDropdown
          onSelect={(event, newProject) => {
            setActiveProject(newProject);
          }}
          selected={activeProject}
          shortCut={KEYBOARD_SHORTCUTS.focusNamespaceDropdown}
        />
      </div>
    </div>
  );
};
