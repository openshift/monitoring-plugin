import type { SetStateAction, Dispatch, FC } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';
import { KEYBOARD_SHORTCUTS } from './utils';
import { getDashboardsListUrl, usePerspective } from '../../../hooks/usePerspective';
import ProjectDropdown from './ProjectDropdown';

export type ProjectBarProps = {
  setActiveProject: Dispatch<SetStateAction<string | null>>;
  activeProject: string | null;
};

export const ProjectBar: FC<ProjectBarProps> = ({ setActiveProject, activeProject }) => {
  const navigate = useNavigate();
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
            navigate(url);
          }}
          selected={activeProject || ''}
          shortCut={KEYBOARD_SHORTCUTS.focusNamespaceDropdown}
        />
      </div>
    </div>
  );
};
