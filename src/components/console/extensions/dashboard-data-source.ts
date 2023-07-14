type ExtensionFlags = Partial<{
  required: string[];
  disallowed: string[];
}>;

type Extension<P extends {} = any> = {
  type: string;
  properties: P;
  flags?: ExtensionFlags;
};

type ExtensionDeclaration<T extends string, P extends {}> = Extension<P> & {
  type: T;
};

type CodeRef<T = any> = () => Promise<T>;

export type DataSource = ExtensionDeclaration<
  'console.dashboards/datasource',
  {
    contextId: string;
    /** Returns a extension function that provides a custom data source object */
    getDataSource: CodeRef<(dataSourceID: string) => Promise<CustomDataSource>>;
  }
>;

export const isDataSource = (e: Extension): e is DataSource => {
  return e.type === 'console.dashboards/datasource';
};

export type CustomDataSource = {
  basePath: string;
  dataSourceType: string;
};
