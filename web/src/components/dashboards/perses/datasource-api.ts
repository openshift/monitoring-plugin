import {
  DatasourceResource,
  DatasourceSelector,
  GlobalDatasourceResource,
  DatasourceApi,
} from '@perses-dev/core';
import { fetchDatasourceList } from './perses/datasource-client';
import { fetchGlobalDatasourceList } from './perses/global-datasource-client';
import { TFunction } from 'i18next';

export class OcpDatasourceApi implements DatasourceApi {
  constructor(public t: TFunction, public basePath: string) {}
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
    return `${this.basePath}/proxy/${url}`;
  }

  getDatasource = async (
    project: string,
    selector: DatasourceSelector,
  ): Promise<DatasourceResource> => {
    return fetchDatasourceList(
      project,
      selector.kind,
      selector.name ? undefined : true,
      selector.name,
    ).then((list) => {
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error(this.t('No matching datasource found'));
      }
      const datasource = list[0];
      return datasource;
    });
  };

  getGlobalDatasource = async (selector: DatasourceSelector): Promise<GlobalDatasourceResource> => {
    return fetchGlobalDatasourceList(
      selector.kind,
      selector.name ? undefined : true,
      selector.name,
    ).then((list) => {
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error(this.t('No matching datasource found'));
      }
      const datasource = list[0];
      return datasource;
    });
  };

  listDatasources(project: string, pluginKind?: string): Promise<DatasourceResource[]> {
    return fetchDatasourceList(project, pluginKind);
  }

  listGlobalDatasources(pluginKind?: string): Promise<GlobalDatasourceResource[]> {
    return fetchGlobalDatasourceList(pluginKind);
  }
}
