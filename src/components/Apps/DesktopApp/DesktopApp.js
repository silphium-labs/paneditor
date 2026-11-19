// import { createEffect } from 'solid-js';

import './DesktopApp.css';
import { on } from '../../signal.js';
import { jsx } from '../../jsx.js';

export function* __DesktopApp() {
  yield* jsx('<span { class: "desktop-app" }>', '"Desktop."', '</>');

  // on(click, () => {});
}

let DesktopApp = () => () => __DesktopApp({});

export default DesktopApp;
