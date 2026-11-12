import { createEffect } from 'solid-js';

import './Clock.css';

function clockInput(time) {
  return `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`;
}

function Clock() {
  let el = <div class="clock"></div>;

  (function updateClock() {
    let now = new Date();
    setTimeout(updateClock, (62 - now.getSeconds()) * 1000);
    el.innerText = clockInput(now);
  })();

  return el;
}

export default Clock;
