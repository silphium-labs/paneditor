import classnames from 'classnames';
import { printString } from 'agast';
import Output from './Output.js';

export function* __Evaluation({ command, output, returnValue }) {
  yield '<div { class: "evaluation" }>';
  yield '<div { class: "input" }>';
  yield '<span { class: "prompt" }>';
  yield '">_\u00a0"';
  yield '</>';
  yield '<span { class: "command" }>';
  if (command()) {
    yield printString(command());
  }
  yield '</>';
  if (!output() && !returnValue()) {
    yield '<span { class: "cursor" } />';
  }
  yield '</>';

  if (output()) {
    yield* ['<(Output)>', Output({ output }), '</>'];
  } else {
    yield '<div { class: "output" } />';
  }

  yield `<div { class: ${printString(
    classnames({
      return: true,
      running: !!output(),
      done: !!returnValue(),
      failed: returnValue() && !returnValue().success,
    }),
  )} }>`;

  yield '<span { class: "status" } />';
  yield '<span { class: "message" } />';
  yield '</>';
  yield '</>';
}

let Evaluation = ({ command, output, returnValue }) => {
  return () => __Evaluation({ command, output, returnValue });
};

export default Evaluation;
