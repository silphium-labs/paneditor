import { useContext } from 'solid-js';
import { AgastContext, SelectionContext } from '../../state/store.js';

import './ContextPane.css';

function ContextPane() {
  const agastContext = useContext(AgastContext);
  const { selectedRange } = useContext(SelectionContext);

  return (
    <>
      <div class="context-pane">{() => agastContext.nodeForTag(selectedRange()[1])?.type}</div>
    </>
  );
}

export default ContextPane;
