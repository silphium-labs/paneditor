import TerminalApp from '../Apps/TerminalApp/TerminalApp.js';

import './Terminal.css';
import { on, send } from '../signal.js';
import { jsx } from '../jsx.js';

export function* __Terminal({ activeApp }) {
  let { click } = yield* jsx(
    '<span { class: "terminal" } @{click}>',
    '<span { class: "icon" }>',
    '</>',
    '</>',
  );

  on(click, () => {
    send(activeApp, TerminalApp);
  });
}

let Terminal =
  ({ activeApp }) =>
  () =>
    __Terminal({ activeApp });

export default Terminal;
