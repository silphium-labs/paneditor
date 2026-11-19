import './Desktop.css';
import { on, send } from '../signal.js';
import { jsx } from '../jsx.js';
import DesktopApp from '../Apps/DesktopApp/DesktopApp.js';

export function* __Desktop({ activeApp }) {
  let { click } = yield* jsx(
    '<span { class: "desktop" } @{click}>',
    '<span { class: "desk" }>',
    '</>',
    '</>',
  );

  on(click, () => {
    send(activeApp, DesktopApp);
  });
}

let Desktop =
  ({ activeApp }) =>
  () =>
    __Desktop({ activeApp });

export default Desktop;
