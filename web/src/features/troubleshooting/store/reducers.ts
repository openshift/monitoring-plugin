import { Map as ImmutableMap } from 'immutable';

import { ActionType, LEFT_TO_RIGHT, TPAction, defaultSearch } from './redux-actions';

export type TPState = ImmutableMap<string, any>;

export type State = {
  observe: TPState;
  plugins: {
    tp: TPState;

    mp: any;
  };
};

const reducer = (state: TPState, action: TPAction): TPState => {
  if (!state) {
    return ImmutableMap({
      isOpen: false,
      search: defaultSearch,
      agentConnected: false,
      agentEnabled: false,
      agentError: '',
      agentToast: '',
      rankdir: LEFT_TO_RIGHT,
    });
  }

  switch (action.type) {
    case ActionType.CloseTroubleshootingPanel:
      return state.set('isOpen', false);

    case ActionType.OpenTroubleshootingPanel:
      return state.set('isOpen', true);

    case ActionType.SetSearch:
      return state.set('search', action.payload);

    case ActionType.SetAgentConnected:
      return state.set('agentConnected', action.payload);

    case ActionType.SetAgentError:
      return state.set('agentError', action.payload);

    case ActionType.SetAgentEnabled:
      return state.set('agentEnabled', action.payload);

    case ActionType.SetAgentToast:
      return state.set('agentToast', action.payload);

    case ActionType.SetRankdir:
      return state.set('rankdir', action.payload);

    default:
      break;
  }
  return state;
};

export default reducer;
