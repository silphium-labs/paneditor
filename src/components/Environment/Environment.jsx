import { createSignal } from 'solid-js';
import { AgastContext } from 'bablr';
import Editor from '../Editor/Editor.jsx';
import ContextPane from '../ContextPane/ContextPane.jsx';
import { SelectionContext, AgastContext as AgastSolidContext } from '../../state/store.js';

import './Environment.css';

function Environment() {
  const [selectedRange, setSelectedRange] = createSignal([null, null]);

  return (
    <>
      <AgastSolidContext.Provider value={AgastContext.create()}>
        <SelectionContext.Provider value={{ selectedRange, setSelectedRange }}>
          <div class="environment">
            <Editor />
            <ContextPane />
          </div>
        </SelectionContext.Provider>
      </AgastSolidContext.Provider>
    </>
  );
}

export default Environment;
