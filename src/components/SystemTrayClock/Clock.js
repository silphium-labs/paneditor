/* global setTimeout */

import { printString } from 'agast';
import { send, signal } from '../signal.js';
import './Clock.css';

function printTime(date) {
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function* __Clock({ time }) {
  yield* ['<div { class: "clock" }>', printString(time()), '</>'];
}

let time = signal(printTime(new Date()));

(function updateClock() {
  let now = new Date();
  setTimeout(updateClock, (62 - now.getSeconds()) * 1000);

  send(time, printTime(now));
})();

let Clock = (props) => () => __Clock({ time });

export default Clock;
