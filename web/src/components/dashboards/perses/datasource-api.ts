import { DatasourceResource, DatasourceSelector, GlobalDatasourceResource } from '@perses-dev/core';
import { DatasourceApi } from '@perses-dev/dashboards';
import { getCSRFToken } from '../../proxied-fetch';
import { fetchDatasourceList } from './perses/datasource-client';
import { fetchGlobalDatasourceList } from './perses/global-datasource-client';

export class OcpDatasourceApi implements DatasourceApi {
  /**
   * Helper function for getting a proxy URL from separate input parameters.
   * Give the following output according to the definition or not of the input.
   * - /proxy/globaldatasources/{name}
   * - /proxy/projects/{project}/datasources/{name}
   * - /proxy/projects/{project}/dashboards/{dashboard}/{name}
   *
   * NB: despite the fact it's possible, it is useless to give a dashboard without a project as
   * the url will for sure correspond to nothing.
   * @param name
   * @param dashboard
   * @param project
   */
  buildProxyUrl({
    project,
    dashboard,
    name,
  }: {
    project?: string;
    dashboard?: string;
    name: string;
  }): string {
    let url = `${!project && !dashboard ? 'globaldatasources' : 'datasources'}/${encodeURIComponent(
      name,
    )}`;
    if (dashboard) {
      url = `dashboards/${encodeURIComponent(dashboard)}/${url}`;
    }
    if (project) {
      url = `projects/${encodeURIComponent(project)}/${url}`;
    }
    return `/proxy/${url}`;
  }

  getDatasource(
    project: string,
    selector: DatasourceSelector,
  ): Promise<DatasourceResource | undefined> {
    return fetchDatasourceList(
      project,
      selector.kind,
      selector.name ? undefined : true,
      selector.name,
    ).then((list) => {
      // hopefully it should return at most one element
      const datasource = list[0];
      datasource.spec.plugin.spec = {
        ...datasource.spec.plugin.spec,
        proxy: {
          spec: {
            headers: {
              'X-CSRFToken': getCSRFToken(),
              'Sec-Fetch-Site': 'same-origin',
            },
          },
        },
      };
      return datasource;
    });
  }

  getGlobalDatasource(selector: DatasourceSelector): Promise<GlobalDatasourceResource | undefined> {
    return fetchGlobalDatasourceList(
      selector.kind,
      selector.name ? undefined : true,
      selector.name,
    ).then((list) => {
      const datasource = list[0];
      datasource.spec.plugin.spec = {
        ...datasource.spec.plugin.spec,
        proxy: {
          spec: {
            headers: {
              'X-CSRFToken': getCSRFToken(),
              'Sec-Fetch-Site': 'same-origin',
            },
          },
        },
      };
      return datasource;
    });
  }

  listDatasources(project: string, pluginKind?: string): Promise<DatasourceResource[]> {
    return fetchDatasourceList(project, pluginKind);
  }

  listGlobalDatasources(pluginKind?: string): Promise<GlobalDatasourceResource[]> {
    return fetchGlobalDatasourceList(pluginKind);
  }
}
