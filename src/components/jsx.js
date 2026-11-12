/* global document */
import { renderToDOM } from '@bablr/agast-helpers/component';
import { freezeRecord, isArray, isFunction } from '@bablr/agast-helpers/object';
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
  traverseChildrenInner,
} from 'agast';
import { streamFromTree } from 'bablr/enhanceable';
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

export const writeDOMTree = (tree, htmlRoot) => {
  let node = tree;
  let htmlNode = htmlRoot;

  htmlNode.innerHTML = '';

  for (let tag_ of streamFromTree(tree)) {
    let tag = parseTag(tag_);

    switch (tag.type) {
      case OpenTag:
        {
          let { name, literalValue } = tag.value;

          let newNode = name ? document.createElement(name.description) : null;

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
        break;

      case CloseTag: {
        htmlNode = htmlNode.parentElement;

        break;
      }

      case LiteralTag: {
        let textNode = document.createTextNode(tag.value.value);
        htmlNode.append(textNode);
        break;
      }
    }
  }
};

export const render = (component, htmlRoot) => {
  writeDOMTree(renderToDOM(component), htmlRoot);
};
