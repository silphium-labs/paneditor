import { buildLiteral, printLiteral } from 'agast';
import './AppFrame.css';

// prettier-ignore
let AppFrame = ({ keydown, keyup, activeApp }) => function* () {
  yield '<div { class: "appFrame" }>';
  if (activeApp()) {
    yield '<(App)>';
    yield activeApp()({ keydown, keyup });
    yield '</>';
  }
  yield '</>';
}

export default AppFrame;
