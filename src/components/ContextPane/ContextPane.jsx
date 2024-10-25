import { useContext, Show } from 'solid-js';
import { BABLRContext, SelectionContext, SumContext, nodeBindings } from '../../state/store.js';

import './ContextPane.css';
import { printType } from '@bablr/agast-helpers/print';

function ContextPane() {
  const bablrContext = useContext(BABLRContext);
  const agastContext = bablrContext.agast;
  const { selectionRoot } = useContext(SelectionContext);
  const { widths } = useContext(SumContext);

  const isGap = () => selectionRoot() && selectionRoot().type === Symbol.for('@bablr/gap');

  const flags = () => {
    const { token, trivia, escape, expression, hasGap } = selectionRoot().flags;
    return (
      <>
        <Show when={trivia}>#</Show>
        <Show when={token}>*</Show>
        <Show when={escape}>@</Show>
        <Show when={expression}>+</Show>
        <Show when={hasGap}>$</Show>
      </>
    );
  };

  return (
    <>
      <div class="context-pane">
        <Show when={selectionRoot() && !isGap()}>
          <div class="property-name">
            {() => selectionRoot() && nodeBindings.get(selectionRoot()).dataset.path}:
          </div>
          <div class="title">
            {'<'}
            {flags}
            {() => printType(selectionRoot()?.type)}
            {'>'}
          </div>
          <br />
          <div>width: {() => widths.get(selectionRoot())}</div>
        </Show>
        <Show when={isGap()}>
          <div class="property-name">
            {() => `${selectionRoot().name}${selectionRoot().isArray ? '[]' : ''}`}:
          </div>
          <div class="title">{'<//>'}</div>
          <br />
          <div>width: {() => widths.get(selectionRoot())}</div>
        </Show>
      </div>
    </>
  );
}

export default ContextPane;
