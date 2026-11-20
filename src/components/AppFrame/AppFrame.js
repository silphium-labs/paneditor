import './AppFrame.css';

// prettier-ignore
let AppFrame = ({ keydown, keyup, cwd, fs, activeApp }) => function* () {
  yield '<div { class: "appFrame" }>';
  if (activeApp()) {
    yield '<(App)>';
    yield activeApp()({ cwd, fs, keydown, keyup });
    yield '</>';
  }
  yield '</>';
}

export default AppFrame;
