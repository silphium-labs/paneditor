import './TerminalApp.css';
import { batch, on, send, signal } from '../../signal.js';
import { freezeRecord } from '@bablr/agast-helpers/object';
import * as BList from '@bablr/agast-helpers/b-list';
import Evaluation from './Evaluation.js';

let applyEvent = (str, evt) => {
  let result = str || '';

  let { code, key } = evt;

  if (key != null) {
    result += key;
  } else if (code === 'Backspace') {
    result = result.slice(0, -1);
  }

  return result;
};

export function* __TerminalApp({ fs, cwd, command, evaluations, existingTree, keydown }) {
  // prettier-ignore
  {
    yield '<div { class: "terminal-app" }>';
    if (BList.getSize(evaluations())) {
      for (let { command } of BList.traverse(evaluations())) {
        yield    '<(Evaluation)>'; yield Evaluation({ command, run: true, fs, cwd }); yield '</>';
      }
    }

    yield '<(Evaluation)>';
    yield Evaluation({ command, run: false, fs, cwd });
    yield '</>';
    yield '</>';
  }

  on(keydown, (e) => {
    if (e.code === 'Enter') {
      let command_ = command();
      batch(() => {
        send(
          evaluations,
          BList.push(
            freezeRecord({
              fs,
              cwd,
              command: () => command_,
            }),
            evaluations(),
          ),
        );

        send(command, undefined);
      });

      // return_.classList.add('running');

      // return_.classList.remove('running');
      // return_.classList.add('done');

      // if (!returnValue.success) {
      //   return_.classList.add('return', 'failed');
      // }
    } else {
      send(command, applyEvent(command(), e));
    }
  });
}

let TerminalApp = ({ fs, cwd, keydown }) => {
  let command = signal();
  let evaluations = signal(BList.fromValues([]));

  return (_node, existingTree) =>
    __TerminalApp({ fs, cwd, keydown, command, evaluations, existingTree });
};

export default TerminalApp;
