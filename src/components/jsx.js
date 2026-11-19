/* global document */
import { freezeRecord, isFunction, recordEntries } from '@bablr/agast-helpers/object';
import { Path } from '@bablr/agast-helpers/path';
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
import { untrackComponent, createComponentRoot, createComponentEffect } from './signal.js';

let porcelain = { porcelain: true };

export function* native(dom) {
  let { flags, type, name, literalValue, attributes, isSelfClosing } = parseOpen(dom[0]);

  flags = freezeRecord({ ...flags, component: false });

  yield printTag(
    buildOpenTag(flags, type, name, literalValue, attributes, isSelfClosing),
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

function __render(component, htmlRoot, startIndex_, endIndex) {
  return createComponentRoot(() => {
    return createComponentEffect(() => {
      let iter = component()[Symbol.iterator]();
      let stack = [];
      let step;
      let resultPath = null;
      let htmlNode = htmlRoot;
      let componentPath = null;
      let startIndex = startIndex_;
      let startIndexes = [startIndex_];

      do {
        loop: while (!(step = iter.next()).done) {
          let tag_ = step.value;
          let tag = parseTag(tag_);

          switch (tag.type) {
            case TreeNode:
            case Property: {
              let node = tag.type === Property ? tag.value[4] : tag.value;
              let sigilTag = parseTag(node[0]);
              if (sigilTag.value.flags.component || componentPath) {
                componentPath = Path.advance(componentPath, tag_);
              } else {
                resultPath = Path.advance(resultPath, tag_);
              }

              if (sigilTag.value.flags.component) {
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
              let { flags, name, literalValue, attributes, isSelfClosing } = tag.value;

              if (flags.component || componentPath) {
                stack.push({ iter, resultPath, componentPath });
                componentPath = null;

                componentPath = Path.advance(componentPath, tag_);
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

                if (!isSelfClosing) {
                  startIndexes.push(0);
                }

                htmlNode = name ? newNode : htmlNode;
              }

              break;
            }

            case Function: {
              let fn = tag.value;

              if (!componentPath || !componentPath.sigilTag.value.flags.component)
                throw new Error();
              let openTag = componentPath.node[0];

              componentPath = Path.advance(componentPath, fn);

              if (parseTag(openTag).value.isSelfClosing) {
                throw new Error();
              }

              break;
            }

            case CloseTag: {
              startIndex = startIndexes.pop() + 1;

              if (componentPath) {
                let { depth } = componentPath;
                componentPath = Path.advance(componentPath, tag_);

                let finishedPath = depth ? componentPath.tagPathAt(-1).inner : componentPath;

                if (finishedPath.sigilTag.value.flags.component) {
                  componentPath = null;
                  resultPath = null;

                  let { node } = finishedPath;
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
              } else {
                let lastResultPath = resultPath;
                resultPath = Path.advance(resultPath, tag_);

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
