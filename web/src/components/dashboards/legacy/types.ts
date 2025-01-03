export type ColumnStyle = {
  alias?: string;
  decimals?: number;
  unit?: string;
  pattern: string;
  type: string;
};

type ValueMap = {
  op: string;
  text: string;
  value: string;
};

type YAxis = {
  format: string;
};

export type Panel = {
  breakpoint?: string;
  datasource?: DataSource;
  decimals?: number;
  format?: string;
  gridPos?: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  id: string;
  legend?: {
    show: boolean;
  };
  options?: {
    fieldOptions: {
      thresholds: {
        color?: string;
        value: number;
      }[];
    };
  };
  panels: Panel[];
  postfix?: string;
  postfixFontSize?: string;
  prefix?: string;
  prefixFontSize?: string;
  span: number;
  stack: boolean;
  styles?: ColumnStyle[];
  targets: Array<{
    expr: string;
    legendFormat?: string;
    refId: string;
  }>;
  title: string;
  transform?: string;
  type: string;
  units?: string;
  valueFontSize?: string;
  valueMaps?: ValueMap[];
  yaxes: YAxis[];
};

export type Row = {
  collapse?: boolean;
  panels: Panel[];
  showTitle?: boolean;
  title?: string;
};

type TemplateVariable = {
  datasource: DataSource;
  hide: number;
  includeAll: boolean;
  name: string;
  options: { selected: boolean; value: string }[];
  query: string;
  type: string;
};

// TODO: Board is currently legacy dashboard shaped. As we bring in the perses
// dashboards we will need to create a shared board type which can be used in
// the dashboard dropdown for both legacy and perses dashboards
export type Board = {
  data: {
    panels: Panel[];
    rows: Row[];
    templating: {
      list: TemplateVariable[];
    };
    tags: string[];
    title: string;
  };
  name: string;
};

export type DataSource = {
  name: string;
  type: string;
};
