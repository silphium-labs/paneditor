/* @refresh reload */
/* global document, globalThis */
import { defaultState, StoreContext } from './state/store.js';

import { enableDragDropTouch } from 'drag-drop-touch';

import './index.css';
import { parseOpen, printObject, printTag } from 'agast';
import { buildEventFacade, native, render } from './components/jsx.js';
import System from './components/System/System.js';
import { send, signal } from './components/signal.js';

globalThis.printTag = printTag;

enableDragDropTouch();

let keydown = signal();
let keyup = signal();

let { body } = document;
let root = document.getElementById('root');

body.addEventListener('keydown', (e) => {
  send(keydown, buildEventFacade(e));
});

body.addEventListener('keyup', (e) => {
  send(keyup, buildEventFacade(e));
});

render([`<(System) { class: 'success' }>`, System({ keydown, keyup }), '</>'], root);
