// import URL from '../URL/URL.js';
// import Clock from '../Clock/Clock.js';
// import { Terminal, FolderTree, SquarePlus } from 'lucide-solid';
import './SystemTray.css';

// prettier-ignore
function* SystemTray() {
  yield '<div {class: "systemTray"}>';

  yield '<* "SystemTray" />'

  yield   '<div {class: "leftIcons"}>';
  //   yield* ['<(Terminal) {size:20px}>', Terminal, '</>'],
  yield   '</>';

  //   yield* ['<(AppTray)>', AppTray, '</>'],
  //   yield* ['<(URL)>', URL, '</>'],
  //   yield* ['<(Clock)>', Clock, '</>'],
  yield '</>';
}

export default SystemTray;
