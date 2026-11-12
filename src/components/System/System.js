import { native } from '../jsx.js';
import SystemTray from '../SystemTray/SystemTray.js';
import './System.css';

// prettier-ignore
function* System() {
  yield* [
    '<div>',
      '<(SystemTray)>', SystemTray, '</>',
      // '<(AppFrame)>', AppFrame, '</>',
    '</>'
  ];
}

export default System;
