import { createSignal, createMemo } from 'solid-js';
import { Context as BABLRContext, streamParse } from 'bablr';
import * as language from '@bablr/language-en-cstml-json';
import Editor from '../Editor/Editor.jsx';
import ContextPane from '../ContextPane/ContextPane.jsx';
import {
  SelectionContext,
  DocumentContext,
  BABLRContext as BABLRSolidContext,
  EditContext,
  nodeBindings,
} from '../../state/store.js';

import './Environment.css';
import { embeddedSourceFrom } from '@bablr/helpers/source';
import { debugEnhancers } from '@bablr/helpers/enhancers';
import { evaluateReturnSync } from '@bablr/agast-helpers/tree';
import { evaluateIO } from '@bablr/io-vm-web';
import { spam } from '@bablr/boot';
import { buildString } from '@bablr/helpers/builders';

let matcher = spam`<$${buildString(language.canonicalURL)}:Expression />`;

const getPath = (node) => {
  let node_ = node;
  let path = [];

  while (node_) {
    path.push(node_);
    node_ = nodeBindings.get(nodeBindings.get(node_).parentNode);
  }

  return path.reverse();
};

const getCommonParent = (a, b) => {
  const aPath = getPath(a);
  const bPath = getPath(b);
  let aIdx = aPath.length - 1;
  let bIdx = bPath.length - 1;

  while ((aIdx || bIdx) && aPath[aIdx] !== bPath[bIdx]) {
    if (aIdx > bIdx) {
      aIdx--;
    } else {
      bIdx--;
    }
  }

  return aPath[aIdx] === bPath[bIdx] ? aPath[aIdx] : null;
};

const defaultDocument = {
  source: embeddedSourceFrom(
    `'[\n  1, 2, -33,\n  444, {\n    num: 5555,\n    str: "hello world",\n    gap: '<//>'\n  }\n]'`,
    // `'[]'`,
  ),
  expressions: [],
};

function Environment() {
  const bablrContext = BABLRContext.from(language);
  const [selectedRange, setSelectedRange] = createSignal([null, null]);
  const [document, setDocument] = createSignal(
    evaluateReturnSync(
      evaluateIO(() =>
        streamParse(
          bablrContext,
          matcher,
          defaultDocument.source,
          {},
          {
            expressions: defaultDocument.expressions,
            emitEffects: true,
            enhancers: debugEnhancers,
          },
        ),
      ),
    ),
  );

  const selectionRoot = createMemo(() => {
    const range = selectedRange();
    const doc = document();

    if (!range[0] || !range[1]) return null;

    if (range[0] === range[1]) {
      let pathNode = range[0];
      let node = nodeBindings.get(pathNode);

      if (node.flags.token && !node.flags.hasGap && !pathNode.dataset.path.endsWith('$')) {
        pathNode = pathNode.parentNode;
        node = nodeBindings.get(pathNode);
      }

      return node;
    } else {
      return getCommonParent(nodeBindings.get(range[0]), nodeBindings.get(range[1]));
    }
  });

  return (
    <>
      <BABLRSolidContext.Provider value={bablrContext}>
        <EditContext.Provider>
          <DocumentContext.Provider value={{ document, setDocument }}>
            <SelectionContext.Provider value={{ selectionRoot, selectedRange, setSelectedRange }}>
              <div class="environment">
                <Editor />
                <ContextPane />
              </div>
            </SelectionContext.Provider>
          </DocumentContext.Provider>
        </EditContext.Provider>
      </BABLRSolidContext.Provider>
    </>
  );
}

export default Environment;
