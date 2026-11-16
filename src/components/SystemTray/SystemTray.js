// import URL from '../URL/URL.js';
import Clock from '../SystemTrayClock/Clock.js';
import Desktop from '../SystemTrayDesktop/Desktop.js';
// import { Terminal, FolderTree, SquarePlus } from 'lucide-solid';
import './SystemTray.css';

// prettier-ignore
function* SystemTray() {
  yield* [
   '<div { class: "systemTray" }>',
    '<div { class: "leftIcons" }>',
      // '<(Terminal) {size:20px}>', Terminal, '</>',
    '</>',
    '<div { class: "rightIcons" }>',
      // '<(AppTray)>', AppTray, '</>',
      // '<(URL)>', URL, '</>',
      '<(Desktop)>', Desktop, '</>',
      '<(SystemTrayClock)>', Clock, '</>',
    '</>',
  '</>',
  ];
}

export default SystemTray;
