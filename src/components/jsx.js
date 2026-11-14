/* global document */
import { freezeRecord, isArray, isFunction, recordEntries } from '@bablr/agast-helpers/object';
import { Path } from '@bablr/agast-helpers/path';
import {
  buildNode,
  buildOpenTag,
  CloseTag,
  Function,
  isValidNode,
  LiteralTag,
  OpenTag,
  parseOpen,
  parseTag,
  printTag,
  Property,
  traverseChildrenInner,
  TreeNode,
} from 'agast';
import { streamFromTree } from 'bablr/enhanceable';
import {
  untrackComponent,
  createRoot,
  createComponentRoot,
  createComponentEffect,
} from './signal.js';

let porcelain = { porcelain: true };

export function* native(dom) {
  let { flags, type, name, literalValue, attributes, selfClosing } = parseOpen(dom[0]);

  flags = freezeRecord({ ...flags, component: false });

  yield printTag(buildOpenTag(flags, type, name, literalValue, attributes, selfClosing), porcelain);

  for (let child of traverseChildrenInner(dom)) {
    if (!isFunction(child)) {
      yield child;
    }
  }

  yield '</>';
}

let getReturnValue = (iterable) => {
  let iter = iterable[Symbol.iterator]();
  let step;
  do {
    step = iter.next();
  } while (!step.done);
  return step.value;
};

export const render = (component, htmlRoot) => {
  let iter = createComponentRoot(() => {
    createComponentEffect(() => {
      let iter = component[Symbol.iterator]();
      let stack = [];
      let step;
      let resultPath = null;
      let htmlNode = htmlRoot;
      let componentPath = null;

      htmlNode.innerHTML = '';

      outer: do {
        while (!(step = iter.next()).done) {
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
                  return createComponentRoot(() => {
                    createComponentEffect(() => {
                      debugger;
                    });

                    return fn(node);
                  });
                });
                continue outer;
              }
              break;
            }

            case OpenTag: {
              if (tag.value.flags.component || componentPath) {
                stack.push({ iter, resultPath, componentPath });
                componentPath = null;

                componentPath = Path.advance(componentPath, tag_);
              } else {
                resultPath = Path.advance(resultPath, tag_);

                let { name, literalValue, attributes } = tag.value;

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

                htmlNode.append(newNode);

                htmlNode = name ? newNode : htmlNode;
              }

              if (tag.value.selfClosing) {
                if (resultPath?.parent) {
                  resultPath = resultPath.parent;
                }
              }
              break;
            }

            case Function: {
              let fn = tag.value;

              if (!componentPath || !componentPath.sigilTag.value.flags.component)
                throw new Error();
              let openTag = componentPath.node[0];

              componentPath = Path.advance(componentPath, fn);

              if (parseTag(openTag).value.selfClosing) {
                throw new Error();
              }

              break;
            }

            case CloseTag: {
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
                    return createComponentRoot(() => {
                      createComponentEffect(() => {
                        debugger;
                      });

                      return fn(node);
                    });
                  });
                  continue outer;
                }
              } else {
                resultPath = Path.advance(resultPath, tag_);

                htmlNode = htmlNode.parentElement;
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

        let finishedResultPath = resultPath;
        ({ iter, resultPath, componentPath } = stack.pop());

        if (componentPath) {
          componentPath = Path.advance(componentPath, finishedResultPath.node);
        } else {
          resultPath = Path.advance(resultPath, finishedResultPath.node);
        }
      } while (true);
    });

    return component;
  });

  return getReturnValue(iter);
};
