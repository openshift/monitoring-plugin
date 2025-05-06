import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter, Link } from 'react-router-dom-v5-compat';
import { combineReducers, createStore } from 'redux';
import MonitoringRouter from './components/router';
import i18n from './i18n';
import ObserveReducers, { ObserveState } from './reducers/observe';

import '@patternfly/patternfly/patternfly.css';

type RootState = { observe: ObserveState };

const baseReducers = Object.freeze({ observe: ObserveReducers });

const store = createStore(combineReducers<RootState>(baseReducers), {});

const App = () => (
  <Provider store={store}>
    <BrowserRouter>
      <div id="page-sidebar">
        Observe
        <Link to="/monitoring/alerts">Alerting</Link>
        <Link to="/monitoring/query-browser">Metrics</Link>
        <Link to="/monitoring/dashboards">Dashboards</Link>
        <Link to="/monitoring/targets">Targets</Link>
      </div>
      <MonitoringRouter />
    </BrowserRouter>
  </Provider>
);

i18n.on('initialized', () => {
  ReactDOM.render(<App />, document.getElementById('app'));
});
