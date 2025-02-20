import { useContext, Show } from 'solid-js';
import { SelectionContext, SumContext, nodeBindings } from '../../state/store.js';

import { printAttributes, printType } from '@bablr/agast-helpers/print';
import { isGapNode } from '@bablr/agast-helpers/path';

import './ContextPane.css';

function ContextPane() {
  const { selectionRoot } = useContext(SelectionContext);
  const { widths } = useContext(SumContext);

  const isGap = () => selectionRoot() && isGapNode(selectionRoot());

  const flags = () => {
    const { token, hasGap } = selectionRoot().flags;
    return (
      <>
        <Show when={token}>*</Show>
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
            {() => {
              const attributes_ = printAttributes(selectionRoot()?.attributes);
              return attributes_ ? ` ${attributes_}` : '';
            }}
            {' />'}
          </div>
          <br />
          <div>width: {() => widths.get(selectionRoot())}</div>
        </Show>
        <Show when={isGap()}>
          <div class="property-name">
            {() => selectionRoot() && nodeBindings.get(selectionRoot()).dataset.path}:
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
