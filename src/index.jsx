/* @refresh reload */
/* global document, globalThis */
import { render } from 'solid-js/web';
import { createStore } from 'solid-js/store';
import { defaultState, StoreContext } from './state/store.js';
import Environment from './components/Environment/Environment.jsx';

import { enableDragDropTouch } from 'drag-drop-touch';

import './index.css';
import { printTag } from '@bablr/agast-helpers/stream';

globalThis.printTag = printTag;

enableDragDropTouch();

const root = document.getElementById('root');

function App() {
  const [store, setStore] = createStore(defaultState);

  return (
    <StoreContext.Provider value={{ store, setStore }}>
      <Environment />
    </StoreContext.Provider>
  );
}

render(() => <App />, root);
