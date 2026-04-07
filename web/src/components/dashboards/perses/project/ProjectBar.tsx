import type { FC } from 'react';
import { KEYBOARD_SHORTCUTS } from './utils';
import ProjectDropdown from './ProjectDropdown';
import { getDashboardsListUrl, usePerspective } from '../../../hooks/usePerspective';
import { useNavigate } from 'react-router';
import { QueryParams } from '../../../query-params';

export type ProjectBarProps = {
  activeProject: string | null;
};

export const ProjectBar: FC<ProjectBarProps> = ({ activeProject }) => {
  const { perspective } = usePerspective();
  const navigate = useNavigate();

  return (
    <div className="co-namespace-bar">
      <div className="co-namespace-bar__items">
        <ProjectDropdown
          onSelect={(event, newProject) => {
            const params = new URLSearchParams();
            params.set(QueryParams.Project, newProject);
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
