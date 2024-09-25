import * as _ from 'lodash-es';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Alert, AlertGroup } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import { LoadingInline } from './status-box';

const injectDisabled = (children, disabled) => {
  return React.Children.map(children, (c) => {
    if (!_.isObject(c) || c.type !== 'button') {
      return c;
    }

    return React.cloneElement(c, { disabled: c.props.disabled || disabled });
  });
};

const ErrorMessage = ({ message }) => {
  const { t } = useTranslation();
  return (
    <Alert
      isInline
      className="co-alert co-alert--scrollable"
      variant="danger"
      title={t('An error occurred')}
    >
      <div className="co-pre-line">{message}</div>
    </Alert>
  );
};

// NOTE: DO NOT use <a> elements within a ButtonBar.
// They don't support the disabled attribute, and therefore
// can't be disabled during a pending promise/request.
/** @type {React.SFC<{children: any, errorMessage?: React.ReactNode, inProgress?: boolean}}>} */
export const ButtonBar = ({
  children,
  errorMessage,
  inProgress,
}) => {
  return (
    <div className="co-m-btn-bar">
      <AlertGroup
        isLiveRegion
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions text"
      >
        {errorMessage && <ErrorMessage message={errorMessage} />}
        {injectDisabled(children, inProgress)}
        {inProgress && <LoadingInline />}
      </AlertGroup>
    </div>
  );
};

ButtonBar.propTypes = {
  children: PropTypes.node.isRequired,
  errorMessage: PropTypes.node,
  inProgress: PropTypes.bool,
};
