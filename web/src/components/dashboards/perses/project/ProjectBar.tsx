import * as React from 'react';
import { KEYBOARD_SHORTCUTS } from './utils';
import ProjectDropdown from './ProjectDropdown';

export type ProjectBarProps = {
  setActiveProject: React.Dispatch<React.SetStateAction<string>>;
  activeProject: string;
};

export const ProjectBar: React.FC<ProjectBarProps> = ({ setActiveProject, activeProject }) => {
  return (
    <div className="co-namespace-bar">
      <div className="co-namespace-bar__items">
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
