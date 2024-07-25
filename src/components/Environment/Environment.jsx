import { createSignal, createMemo } from 'solid-js';
import { AgastContext } from 'bablr';
import Editor from '../Editor/Editor.jsx';
import ContextPane from '../ContextPane/ContextPane.jsx';
import {
  SelectionContext,
  AgastContext as AgastSolidContext,
  SumContext,
} from '../../state/store.js';

import './Environment.css';

const getCommonParent = (a, b) => {
  let a_ = a;
  let b_ = b;

  while ((a_.depth || b_.depth) && a_ !== b_) {
    if (a_.depth > b_.depth) {
      a_ = a_.parent;
    } else {
      b_ = b_.parent;
    }
  }

  return a_ === b_ ? a_ : null;
};

function Environment() {
  const agastContext = AgastContext.create();
  const [selectedRange, setSelectedRange] = createSignal([null, null]);

  const selectionRoot = createMemo(() => {
    const range = selectedRange();

    if (!range[0] || !range[1]) return null;

    const getPath = (terminal) => {
      let path = agastContext.pathForTag(terminal);
      let node = agastContext.nodeForTag(terminal);
      if (node?.flags.intrinsic) {
        return path.parent;
      }
      return path;
    };

    return getCommonParent(getPath(range[0]), getPath(range[1]));
  });

  return (
    <>
      <AgastSolidContext.Provider value={agastContext}>
        <SumContext.Provider>
          <SelectionContext.Provider value={{ selectionRoot, selectedRange, setSelectedRange }}>
            <div class="environment">
              <Editor />
              <ContextPane />
            </div>
          </SelectionContext.Provider>
        </SumContext.Provider>
      </AgastSolidContext.Provider>
    </>
  );
}

export default Environment;
