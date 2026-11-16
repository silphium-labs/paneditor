/* global setTimeout */
// import { createEffect } from 'solid-js';

import { printString } from 'agast';
// import { send, signal } from '../signal.js';
import './Desktop.css';

export function* __Desktop() {
  yield* ['<span { class: "desktop" }>', '<span { class: "desk" }>', '</>', '</>'];
}

function Desktop() {
  return __Desktop({});
}

export default Desktop;
