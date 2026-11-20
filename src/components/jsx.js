/* global document */
import { freezeRecord, isFunction, recordEntries } from '@bablr/agast-helpers/object';
import { buildFlags, Path } from '@bablr/agast-helpers/path';
import {
  buildOpenTag,
  CloseTag,
  Function,
  LiteralTag,
  OpenTag,
  parseOpen,
  parseTag,
  printTag,
  Property,
  traverseChildrenInner,
  TreeNode,
} from 'agast';
import {
  untrackComponent,
  createComponentRoot,
  createComponentEffect,
  send,
  signal,
} from './signal.js';

let porcelain = { porcelain: true };

export function* native(dom) {
  let open = parseOpen(dom[0]);
  let { type, name, literalValue, attributes, events, isSelfClosing } = open;

  let flags = freezeRecord({ ...buildFlags(open), component: false });

  yield printTag(
    buildOpenTag(flags, type, name, literalValue, attributes, events, isSelfClosing),
    porcelain,
  );

  for (let child of traverseChildrenInner(dom)) {
    if (!isFunction(child)) {
      yield child;
    }
  }

  yield '</>';
}

function* wrap(value) {
  return value;
}

export function* jsx() {
  let signals = Object.create(null);

  for (let i = 0; i < arguments.length; i++) {
    let arg = arguments[i];
    let newSignals = yield arg;
    if (newSignals) {
      for (let key in newSignals) {
        if (key in signals) throw new Error();
        signals[key] = newSignals[key];
      }
    }
  }

  return signals;
}

export const render = (component, htmlRoot) => {
  let iter = __render(() => component, htmlRoot)[Symbol.iterator]();
  let step;
  do {
    step = iter.next();
  } while (!step.done);

  return step.value;
};

let allModifiers = [
  'Fn',
  'Hyper',
  'OS',
  'Super',
  'Win',
  'Control',
  'Shift',
  'Alt',
  'Meta',
  'Accel',
  'ScrollLock',
  'CapsLock',
  'SymbolLock',
];

export function buildEventFacade(e) {
  switch (e.type) {
    case 'keydown':
    case 'keyup': {
      let { code, key } = e;

      let getModifiers = () => {
        let modifiers = {};
        for (let modifier of allModifiers) {
          modifiers[modifier] = e.getModifierState(modifier);
        }
        return modifiers;
      };

      if (key[0] >= 'A' && key[0] <= 'Z' && key.length > 1) {
        key = null;
      }

      return freezeRecord({ code, key, getModifiers });
    }

    default:
      return freezeRecord({});
  }
}

function __render(component, htmlRoot, startIndex_, endIndex) {
  return createComponentRoot(() => {
    return createComponentEffect(() => {
      let iter = component()[Symbol.iterator]();
      let stack = [];
      let step;
      let resultPath = null;
      let htmlNode = htmlRoot;
      let componentPath = null;
      let startIndex = startIndex_ || 0;
      let startIndexes = [];
      let returnValue = undefined;

      do {
        loop: while (!(step = iter.next(returnValue)).done) {
          let tag_ = step.value;
          let tag = parseTag(tag_);

          returnValue = undefined;

          switch (tag.type) {
            case TreeNode:
            case Property: {
              let node = tag.type === Property ? tag.value[4] : tag.value;
              let sigilTag = parseTag(node[0]);
              if (sigilTag.value.isComponent || componentPath) {
                componentPath = Path.advance(componentPath, tag_);
              } else {
                resultPath = Path.advance(resultPath, tag_);
              }

              if (sigilTag.value.isComponent) {
                stack.push({ iter, resultPath, componentPath });
                componentPath = null;
                resultPath = null;

                let fn = node[1];

                iter = untrackComponent(() => {
                  return __render(
                    () => fn(node),
                    htmlNode,
                    htmlNode.children.length,
                    htmlNode.children.length,
                  );
                });
                continue loop;
              }
              break;
            }

            case OpenTag: {
              let { isComponent, name, literalValue, attributes, events, isSelfClosing } =
                tag.value;

              if (isComponent || componentPath) {
                stack.push({ iter, resultPath, componentPath });
                componentPath = null;

                componentPath = Path.advance(componentPath, tag_);

                startIndexes.push(startIndex);
                startIndex = 0;
              } else {
                resultPath = Path.advance(resultPath, tag_);

                let newNode = name ? document.createElement(name.description) : null;

                for (let { 0: key, 1: value } of recordEntries(attributes)) {
                  newNode.setAttribute(key, value);
                }

                if (literalValue) {
                  let textNode = document.createTextNode(literalValue.value.value);
                  if (name) {
                    newNode.append(textNode);
                  } else {
                    newNode = textNode;
                  }
                }

                if (startIndex !== undefined && startIndex < htmlNode.children.length) {
                  htmlNode.replaceChild(newNode, htmlNode.children[startIndex]);
                } else {
                  htmlNode.append(newNode);
                }

                returnValue = Object.create(null);
                for (let { 0: name, 1: localName } of recordEntries(events)) {
                  let signal_ = signal();
                  newNode.addEventListener(name, (e) => {
                    send(signal_, buildEventFacade(e));
                  });
                  returnValue[localName] = signal_;
                }

                if (!isSelfClosing) {
                  startIndexes.push(startIndex);
                  startIndex = 0;

                  htmlNode = name ? newNode : htmlNode;
                } else {
                  startIndex++;
                }
              }

              break;
            }

            case Function: {
              let fn = tag.value;

              if (!componentPath || !componentPath.sigilTag.value.isComponent) throw new Error();
              let openTag = componentPath.node[0];

              componentPath = Path.advance(componentPath, fn);

              if (parseTag(openTag).value.isSelfClosing) {
                throw new Error();
              }

              break;
            }

            case CloseTag: {
              if (componentPath) {
                let { depth } = componentPath;
                componentPath = Path.advance(componentPath, tag_);

                startIndex = startIndexes.pop() + 1;

                let finishedPath = depth ? componentPath.tagPathAt(-1).inner : componentPath;

                if (finishedPath.sigilTag.value.isComponent) {
                  componentPath = null;
                  resultPath = null;

                  let { node } = finishedPath;
                  let fn = node[1];

                  let startIndex_ = startIndex;
                  let htmlNode_ = htmlNode;
                  iter = untrackComponent(() => {
                    return __render(
                      () => {
                        return fn(node, htmlNode_.children[startIndex_]?.agAST);
                      },
                      htmlNode_,
                      htmlNode_.children.length,
                      htmlNode_.children.length,
                    );
                  });

                  continue loop;
                }
              } else {
                let lastResultPath = resultPath;
                resultPath = Path.advance(resultPath, tag_);

                startIndex = startIndexes.pop() + 1;

                htmlNode.agAST = resultPath.node;

                // if (lastResultPath.depth) {
                htmlNode = htmlNode.parentElement;
                // }
              }

              break;
            }

            case LiteralTag: {
              if (componentPath) {
                componentPath = Path.advance(componentPath, tag_);
              } else if (resultPath) {
                resultPath = Path.advance(resultPath, tag_);

                let textNode = document.createTextNode(tag.value.value);
                htmlNode.append(textNode);
              }
              break;
            }

            default: {
              if (componentPath) {
                componentPath = Path.advance(componentPath, tag_);
              } else if (resultPath) {
                resultPath = Path.advance(resultPath, tag_);
              }
              break;
            }
          }
        }

        if (!stack.length) break;

        if (!htmlNode.agAST) {
          htmlNode = htmlNode.lastChild;
        }

        let finishedNode = resultPath?.node || htmlNode.agAST;
        ({ iter, resultPath, componentPath } = stack.pop());
        htmlNode = htmlNode.parentElement;

        if (componentPath) {
          componentPath = Path.advance(componentPath, finishedNode);
        } else {
          resultPath = Path.advance(resultPath, finishedNode);
        }
      } while (true);

      return wrap(step.value);
    });
  });
}
