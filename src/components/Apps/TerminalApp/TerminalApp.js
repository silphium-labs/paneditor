import './TerminalApp.css';
import { on, send, signal } from '../../signal.js';
import { printString } from 'agast';

let applyEvent = (str, evt) => {
  let result = str || '';

  let { code, key, getModifiers } = evt;

  let modifiers = getModifiers();

  if (key != null) {
    let chr = code[3];
    if (!(modifiers.Shift || modifiers.CapsLock)) {
      chr = chr.toLowerCase();
    }
    result += chr;
  } else if (code === 'Backspace') {
    result = result.slice(0, -1);
  }

  return result;
};

// prettier-ignore
export function* __TerminalApp({ command, keydown }) {
  yield '<div { class: "terminal-app" }>';
  yield   '<div { class: "evaluation" }>';
  yield     '<div { class: "input" }>';
  yield       '<span { class: "prompt" }>';
  yield         '">_\u00a0"';
  yield       '</>';
  yield       '<span { class: "cursor" } />';
  yield       '<span { class: "command" }>';
  if (command()) {
    yield       printString(command());
  }
  yield       '</>';
  yield     '</>';
  yield     '<div { class: "output" } />';
  yield     '<div { class: "return" }>';
  yield       '<span { class: "status" } />';
  yield       '<span { class: "message" } />';
  yield     '</>';
  yield   '</>';
  yield '</>';

  on(keydown, (e) => {
    send(command, applyEvent(command(), e));
  });
}

let TerminalApp = ({ keydown }) => {
  let command = signal();
  return () => __TerminalApp({ command, keydown });
};

export default TerminalApp;
