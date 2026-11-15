// import URL from '../URL/URL.js';
import Clock from '../Clock/Clock.js';
// import { Terminal, FolderTree, SquarePlus } from 'lucide-solid';
import './SystemTray.css';

// prettier-ignore
function* SystemTray() {
  yield  '<div { class: "systemTray" }>';
    yield '<div { class: "leftIcons" }>';
      // '<(Terminal) {size:20px}>', Terminal, '</>',
    yield '</>';

    // '<(AppTray)>', AppTray, '</>',
    // '<(URL)>', URL, '</>',
    yield '<(Clock)>'; yield Clock; 
    yield '</>';
  yield '</>';
}

export default SystemTray;
