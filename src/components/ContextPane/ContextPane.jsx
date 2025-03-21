import { useContext } from 'solid-js';
import { ReduxContext } from '../../state/solid.js';

import './ContextPane.css';
import HierarchyContext from './HierarchyContext.jsx';
import SnippetsContext from './SnippetsContext.jsx';

function ContextPane() {
  let { store } = useContext(ReduxContext);
  let content = () => {
    switch (store.focus) {
      case 'hierarchy':
        return <HierarchyContext />;
      case 'snippets':
        return <SnippetsContext />;
    }
    return null;
  };

  return (
    <>
      <div class="context-pane">{content()}</div>
    </>
  );
}

export default ContextPane;
