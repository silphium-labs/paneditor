// import { createEffect } from 'solid-js';

import './Desktop.css';
import { on } from '../signal.js';
import { jsx, native } from '../jsx.js';

export function* __Desktop() {
  let { click } = yield* jsx(
    '<(span) { class: "desktop" } @{click}>',
    native,
    '<span { class: "desk" }>',
    '</>',
    '</>',
  );

  on(click, () => {
    debugger;
  });
}

function Desktop() {
  return __Desktop({});
}

export default Desktop;
