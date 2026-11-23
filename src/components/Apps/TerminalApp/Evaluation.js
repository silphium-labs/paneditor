import ls from './builtins/ls.js';
import rm from './builtins/rm.js';
import rmdir from './builtins/rmdir.js';
import false_ from './builtins/false.js';
import tree from './builtins/tree.js';

import classnames from 'classnames';
import { buildOpen, OpenTag, parseTag, printOpen, printString } from 'agast';
import Output from './Output.js';
import { batch, send, signal } from '../../signal.js';
import { freezeRecord, isDeepRecord } from '@bablr/agast-helpers/object';
import { buildFlags } from '@bablr/agast-helpers/path';

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
    yield '<(Output)>';
    yield Output({ output });
    yield '</>';
  } else {
    yield 'output:';
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

let Evaluation = ({ command, run, fs, cwd }) => {
  let returnValue = signal();
  let output = () => null;

  if (run) {
    output = () =>
      (function* __output() {
        try {
          let text = command();

          // TODO: this, better
          let parts = text.split(' ');

          let cmd = parts[0];

          if (cmd === 'cd') {
            let target = parts[1];

            if (target === '..') {
              cwd().pop();
            } else {
              cwd().push(target);
            }
          } else {
            let builtin = builtins[cmd];

            let args = parts.slice(1);
            let builtin_ = builtin || (() => false_(['CMD_NOT_FOUND']));

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
      })();
  }

  return () => __Evaluation({ command, output, returnValue, fs, cwd });
};

export default Evaluation;
