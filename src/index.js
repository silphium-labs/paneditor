/* @refresh reload */
/* global document, globalThis */
import { defaultState, StoreContext } from './state/store.js';

import { enableDragDropTouch } from 'drag-drop-touch';

import './index.css';
import { parseOpen, printObject, printTag } from 'agast';
import { native, render } from './components/jsx.js';
import System from './components/System/System.js';

globalThis.printTag = printTag;

enableDragDropTouch();

let root = document.getElementById('root');

render([`<(System) { class: 'success' }>`, System, '</>'], root);
