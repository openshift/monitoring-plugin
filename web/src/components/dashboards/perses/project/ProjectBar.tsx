import * as React from 'react';
import { KEYBOARD_SHORTCUTS } from './utils';
import ProjectDropdown from './ProjectDropdown';
import { getDashboardsListUrl, usePerspective } from '../../../hooks/usePerspective';
import { useHistory } from 'react-router';

export type ProjectBarProps = {
  setActiveProject: React.Dispatch<React.SetStateAction<string>>;
  activeProject: string;
};

export const ProjectBar: React.FC<ProjectBarProps> = ({ setActiveProject, activeProject }) => {
  const history = useHistory();
  const { perspective } = usePerspective();
  return (
    <div className="co-namespace-bar">
      <div className="co-namespace-bar__items">
        <ProjectDropdown
          onSelect={(event, newProject) => {
            const params = new URLSearchParams();
            if (newProject === '') {
              setActiveProject(null);
            } else {
              params.set('project', newProject);
              setActiveProject(newProject);
            }
            const url = `${getDashboardsListUrl(perspective)}?${params.toString()}`;
            history.push(url);
          }}
          selected={activeProject || ''}
          shortCut={KEYBOARD_SHORTCUTS.focusNamespaceDropdown}
        />
      </div>
    </div>
  );
};
