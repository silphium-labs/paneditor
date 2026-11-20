import ls from './builtins/ls.js';
import rm from './builtins/rm.js';
import rmdir from './builtins/rmdir.js';
import false_ from './builtins/false.js';
import tree from './builtins/tree.js';

import './TerminalApp.css';
import { on, send, signal } from '../../signal.js';
import { buildOpen, OpenTag, parseTag, printOpen, traverseChildren } from 'agast';
import { freezeRecord, isDeepRecord } from '@bablr/agast-helpers/object';
import { buildFlags } from '@bablr/agast-helpers/path';
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

let builtins = Object.assign(Object.create(null), {
  ls(fs, cwd, args) {
    let argsIdx = 0;

    let dir;
    let arg = args[argsIdx];
    let flagsStr = '';
    while (arg?.[0] === '-') {
      flagsStr += arg[1];
      arg = args[++argsIdx];
    }
    dir = arg;
    let flags = freezeRecord({ all: flagsStr.includes('a') });

    return ls({ fs, cwd, dir, flags });
  },
  rm,
  rmdir,
  false: false_,
  tree,
});

export function* __TerminalApp({ fs, cwd, command, output, returnValue, existingTree, keydown }) {
  // prettier-ignore
  {
    yield '<div { class: "terminal-app" }>';
    if (existingTree) {
      debugger
      for (let value of traverseChildren(existingTree)) {
        yield value;
      }
    }
    yield    '<(Evaluation)>'; yield Evaluation({ command, output, returnValue }); yield '</>';
    yield '</>';
  }

  on(keydown, (e) => {
    if (e.code === 'Enter') {
      let text = command();

      // TODO: this, better
      let parts = text.split(' ');

      let cmd = parts[0];

      let builtin = builtins[cmd];

      if (cmd === 'cd') {
        let target = parts[1];

        if (target === '..') {
          cwd().pop();
        } else {
          cwd().push(target);
        }
      } else {
        let args = parts.slice(1);
        let builtin_ = builtin || (() => false_(['CMD_NOT_FOUND']));

        send(
          output,
          (function* () {
            try {
              let iter = builtin_(fs(), cwd(), args)[Symbol.iterator]();
              let step;

              while (!(step = iter.next()).done) {
                let tag_ = step.value;
                let tag = parseTag(tag_);

                if (tag.type === OpenTag) {
                  let { type, name, literalValue, events, isSelfClosing } = tag.value;

                  let newTag = buildOpen(
                    buildFlags(tag),
                    type,
                    'node',
                    literalValue,
                    freezeRecord({ name }),
                    events,
                    isSelfClosing,
                  );

                  yield printOpen(newTag);
                } else {
                  yield tag_;
                }
              }

              let { value } = step;

              if (!isDeepRecord(value)) {
                send(
                  returnValue,
                  freezeRecord({
                    success: false,
                    data: freezeRecord({ reason: 'BAD_RETURN_VALUE' }),
                  }),
                );
              } else {
                send(returnValue, value);
              }
            } catch (e) {
              send(
                returnValue,
                freezeRecord({
                  success: false,
                  data: freezeRecord({ reason: 'EVAL_ERROR', message: e.message }),
                }),
              );
            }
          })(),
        );

        // return_.classList.add('running');

        // return_.classList.remove('running');
        // return_.classList.add('done');

        // if (!returnValue.success) {
        //   return_.classList.add('return', 'failed');
        // }
      }
    } else {
      send(command, applyEvent(command(), e));
    }
  });
}

let TerminalApp = ({ fs, cwd, keydown }) => {
  let command = signal();
  let output = signal();
  let returnValue = signal();
  return (_node, existingTree) =>
    __TerminalApp({ fs, cwd, keydown, command, output, returnValue, existingTree });
};

export default TerminalApp;
