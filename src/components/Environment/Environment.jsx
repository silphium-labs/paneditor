import { createSignal, createMemo } from 'solid-js';
import { AgastContext, Context as BABLRContext } from 'bablr';
import * as language from '@bablr/language-en-json';
import Editor from '../Editor/Editor.jsx';
import ContextPane from '../ContextPane/ContextPane.jsx';
import {
  SelectionContext,
  BABLRContext as BABLRSolidContext,
  SumContext,
  nodeBindings,
} from '../../state/store.js';

import './Environment.css';

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

function Environment() {
  const agastContext = AgastContext.create();
  const bablrContext = BABLRContext.from(agastContext, language);
  const [selectedRange, setSelectedRange] = createSignal([null, null]);

  const selectionRoot = createMemo(() => {
    const range = selectedRange();

    if (!range[0] || !range[1]) return null;

    return range[0] === range[1] ? range[0] : getCommonParent(range[0], range[1]);
  });

  return (
    <>
      <BABLRSolidContext.Provider value={bablrContext}>
        <SumContext.Provider>
          <SelectionContext.Provider value={{ selectionRoot, selectedRange, setSelectedRange }}>
            <div class="environment">
              <Editor />
              <ContextPane />
            </div>
          </SelectionContext.Provider>
        </SumContext.Provider>
      </BABLRSolidContext.Provider>
    </>
  );
}

export default Environment;
