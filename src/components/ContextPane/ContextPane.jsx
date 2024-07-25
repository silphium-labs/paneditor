import { useContext, Show } from 'solid-js';
import { printExpression } from '@bablr/agast-helpers/print';
import { AgastContext, SelectionContext, SumContext } from '../../state/store.js';

import './ContextPane.css';

function ContextPane() {
  const agastContext = useContext(AgastContext);
  const { selectionRoot } = useContext(SelectionContext);
  const { widths } = useContext(SumContext);

  const isGap = () =>
    selectionRoot() && agastContext.getNextTerminal(selectionRoot().reference)?.type === 'Gap';

  const node = () => agastContext.nodeForPath(selectionRoot());

  const flags = () => {
    const { token, trivia, escape, intrinsic, expression } = node().flags;
    return (
      <>
        <Show when={trivia}>#</Show>
        <Show when={intrinsic}>~</Show>
        <Show when={token}>*</Show>
        <Show when={escape}>@</Show>
        <Show when={expression}>+</Show>
      </>
    );
  };

  return (
    <>
      <div class="context-pane">
        <Show when={selectionRoot() && !isGap()}>
          <div class="property-name">
            {() => `${selectionRoot().name}${selectionRoot().isArray ? '[]' : ''}`}:
          </div>
          <div class="title">
            {'<'}
            {flags}
            {() => node()?.type}
            {'>'}
          </div>
          <br />
          <div>width: {() => widths.get(node())}</div>
        </Show>
        <Show when={isGap()}>
          <div class="property-name">
            {() => `${selectionRoot().name}${selectionRoot().isArray ? '[]' : ''}`}:
          </div>
          <div class="title">{'<//>'}</div>
          <br />
          <div>width: 0</div>
        </Show>
      </div>
    </>
  );
}

export default ContextPane;
