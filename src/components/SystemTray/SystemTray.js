// import URL from '../URL/URL.js';
// import Clock from '../Clock/Clock.js';
// import { Terminal, FolderTree, SquarePlus } from 'lucide-solid';
import './SystemTray.css';

// prettier-ignore
function* SystemTray() {
  yield* [
    '<div { class: "systemTray" }>',
      '<* "SystemTray" />',
      '<div { class: "leftIcons" }>',
        // '<(Terminal) {size:20px}>', Terminal, '</>',
      '</>',

      // '<(AppTray)>', AppTray, '</>',
      // '<(URL)>', URL, '</>',
      // '<(Clock)>', Clock, '</>',
    '</>',
  ];
}

export default SystemTray;
