import { signal } from '../signal.js';
import SystemTray from '../SystemTray/SystemTray.js';
import AppFrame from '../AppFrame/AppFrame.js';
import './System.css';

// prettier-ignore
let System = ({ keydown, keyup }) => function* () {
  let activeApp = signal();
  yield* [
    '<div {class: "system"}>',
      '<(SystemTray)>', SystemTray({ activeApp, keydown, keyup }), '</>',
      '<(AppFrame)>', AppFrame({ activeApp, keydown, keyup }), '</>',
    '</>'
  ];
}

export default System;
