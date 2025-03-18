import * as _ from 'lodash-es';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Alert, AlertGroup, Panel, PanelMain, PanelMainBody } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { LoadingInline } from '../console-shared/src/components/loading/LoadingInline';

const injectDisabled = (children, disabled) => {
  return React.Children.map(children, (c) => {
    if (!_.isObject(c) || c.type !== 'button') {
      return c;
    }

    return React.cloneElement(c, { disabled: c.props.disabled || disabled });
  });
};

const ErrorMessage = ({ message }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  return (
    <Alert isInline variant="danger" title={t('public~An error occurred')} data-test="alert-error">
      <Panel isScrollable>
        <PanelMain maxHeight="100px">
          <PanelMainBody className="pf-v5-u-text-break-word monitoring__pre-line">
            {message}
          </PanelMainBody>
        </PanelMain>
      </Panel>
    </Alert>
  );
};
const InfoMessage = ({ message }) => (
  <Alert isInline variant="info" title={message} data-test="button-bar-info-message" />
);
const SuccessMessage = ({ message }) => <Alert isInline variant="success" title={message} />;

export const ButtonBar = ({
  children,
  className,
  errorMessage,
  infoMessage,
  successMessage,
  inProgress,
}) => {
  return (
    <div className={className}>
      <AlertGroup
        isLiveRegion
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions text"
      >
        {successMessage && <SuccessMessage message={successMessage} />}
        {errorMessage && <ErrorMessage message={errorMessage} />}
        {injectDisabled(children, inProgress)}
        {inProgress && <LoadingInline />}
        {infoMessage && <InfoMessage message={infoMessage} />}
      </AlertGroup>
    </div>
  );
};

ButtonBar.propTypes = {
  children: PropTypes.node.isRequired,
  successMessage: PropTypes.string,
  errorMessage: PropTypes.node,
  infoMessage: PropTypes.string,
  inProgress: PropTypes.bool,
  className: PropTypes.string,
};
