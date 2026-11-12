import { native } from '../jsx.js';
import SystemTray from '../SystemTray/SystemTray.js';
import './System.css';

// prettier-ignore
function* System() {
  yield '<(div)>';
  yield native;

    yield* ['<(SystemTray)>', SystemTray, '</>'];
    // yield* ['<(AppFrame)>', AppFrame, '</>'],
    
  yield '</>';
}

export default System;
