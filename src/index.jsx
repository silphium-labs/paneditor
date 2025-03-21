/* @refresh reload */
/* global document, globalThis */
import { render } from 'solid-js/web';
import { ReduxContext, StoreContext, useRedux } from './state/solid.js';
import { store as unboundReduxStore, actions as unboundReduxActions } from './state/store.js';
import Environment from './components/Environment/Environment.jsx';

import { enableDragDropTouch } from 'drag-drop-touch';

import './index.css';
import { printTag } from '@bablr/agast-helpers/stream';
import { createStore } from 'solid-js/store';

globalThis.printTag = printTag;

enableDragDropTouch();

const root = document.getElementById('root');

const defaultState = {
  selectionState: 'none',
  dragSource: null,
  touchTarget: null,
  touchTimeout: null,
  doubleTouchTarget: null,
  doubleTouchTimeout: null,
  doubleTouchRange: null,
  doubleClickTarget: null,
  doubleClickTimeout: null,
  doubleClickRange: null,
};

function App() {
  const [store, setStore] = createStore(defaultState);

  const { 0: reduxStore, 1: actions } = useRedux(unboundReduxStore, unboundReduxActions);

  return (
    <StoreContext.Provider value={{ store, setStore }}>
      <ReduxContext.Provider value={{ store: reduxStore, actions }}>
        <Environment />
      </ReduxContext.Provider>
    </StoreContext.Provider>
  );
}

render(() => <App />, root);
