import classNames from 'classnames';
import * as _ from 'lodash-es';
import type { FC, RefObject, Ref } from 'react';
import { forwardRef } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom-v5-compat';
import { Title } from '@patternfly/react-core';

import { RootState } from '../../../components/types';
import { getMutlipleQueryBrowserUrl, usePerspective } from '../../hooks/usePerspective';

const getActiveNamespace = ({ UI }: RootState): string => UI.get('activeNamespace');

const mapStateToProps = (state: RootState) => ({
  canAccessMonitoring:
    !!state['FLAGS'].get({ resource: 'namespaces', verb: 'get' }) &&
    !!window.SERVER_FLAGS.prometheusBaseURL,
  namespace: getActiveNamespace(state),
});

const PrometheusGraphLink_: FC<PrometheusGraphLinkProps> = ({
  children,
  query,
  namespace,
  ariaChartLinkLabel,
}) => {
  const { perspective } = usePerspective();
  const queries = _.compact(_.castArray(query));
  if (!queries.length) {
    return <>{children}</>;
  }

  const params = new URLSearchParams();
  queries.forEach((q, index) => params.set(`query${index}`, q));
  const url = getMutlipleQueryBrowserUrl(perspective, params, namespace);

  return (
    <Link
      to={url}
      aria-label={ariaChartLinkLabel}
      style={{ color: 'inherit', textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
};
export const PrometheusGraphLink = connect(mapStateToProps)(PrometheusGraphLink_);

export const PrometheusGraph: FC<PrometheusGraphProps> = forwardRef(
  ({ children, className, title }, ref: RefObject<HTMLDivElement>) => (
    <div ref={ref} className={classNames('graph-wrapper graph-wrapper__horizontal-bar', className)}>
      {title && (
        <Title headingLevel="h5" className="graph-title">
          {title}
        </Title>
      )}
      {children}
    </div>
  ),
);

type PrometheusGraphLinkProps = {
  canAccessMonitoring: boolean;
  query: string | string[];
  namespace?: string;
  ariaChartLinkLabel?: string;
};

type PrometheusGraphProps = {
  className?: string;
  ref?: Ref<HTMLDivElement>;
  title?: string;
};
