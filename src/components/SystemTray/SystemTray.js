// import URL from '../URL/URL.js';
import Terminal from '../SystemTrayTerminal/Terminal.js';
import Desktop from '../SystemTrayDesktop/Desktop.js';
import Clock from '../SystemTrayClock/Clock.js';
import './SystemTray.css';

// prettier-ignore
let SystemTray = ({ activeApp }) => function* () {
  yield* [
   '<div { class: "systemTray" }>',
    '<div { class: "leftIcons" }>',
      '<(Terminal)>', Terminal({ activeApp }), '</>',
    '</>',
    '<div { class: "rightIcons" }>',
      // '<(AppTray)>', AppTray, '</>',
      // '<(URL)>', URL, '</>',
      '<(Desktop)>', Desktop({ activeApp }), '</>',
      '<(SystemTrayClock)>', Clock(), '</>',
    '</>',
  '</>',
  ];
}

export default SystemTray;
