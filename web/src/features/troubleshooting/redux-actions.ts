import { action, ActionType as Action } from 'typesafe-actions';
import { Duration, HOUR, Period } from './time';

export enum ActionType {
  CloseTroubleshootingPanel = 'closeTroubleshootingPanel',
  OpenTroubleshootingPanel = 'openTroubleshootingPanel',
  SetSearch = 'setSearch',
  SetAgentConnected = 'setAgentConnected',
  SetAgentError = 'setAgentError',
  SetAgentEnabled = 'setAgentEnabled',
  SetAgentToast = 'setAgentToast',
  SetRankdir = 'setRankdir',
}

export enum SearchType {
  Depth = 'depth',
  Goal = 'goal',
}

// Search parameters from panel widgets for korrel8r request.
export type Search = {
  queryStr: string;
  searchType: SearchType;
  depth?: number;
  goal?: string;
  period?: Period;
  limit?: number;
};

// Default search parameters do a neighbourhood search of depth 2.
export const defaultSearch: Search = {
  queryStr: '',
  searchType: SearchType.Depth,
  depth: 2,
  period: new Duration(1, HOUR),
  limit: 100,
};

export const closeTP = () => action(ActionType.CloseTroubleshootingPanel);
export const openTP = () => action(ActionType.OpenTroubleshootingPanel);
export const setSearch = (search: Search) => action(ActionType.SetSearch, search);
export const setAgentConnected = (connected: boolean) =>
  action(ActionType.SetAgentConnected, connected);
export const setAgentError = (message: string) => action(ActionType.SetAgentError, message);
export const setAgentEnabled = (enabled: boolean) => action(ActionType.SetAgentEnabled, enabled);
export const setAgentToast = (message: string) => action(ActionType.SetAgentToast, message);
export const LEFT_TO_RIGHT = 'LR';
export const TOP_TO_BOTTOM = 'TB';

export const setRankdir = (rankdir: string) => action(ActionType.SetRankdir, rankdir);

export const actions = {
  closeTP,
  openTP,
  setSearch,
  setAgentConnected,
  setAgentError,
  setAgentEnabled,
  setAgentToast,
  setRankdir,
};

export type TPAction = Action<typeof actions>;
