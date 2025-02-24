import { useContext, createSignal, Show } from 'solid-js';
import { SelectionContext, EditContext, nodeBindings } from '../../state/store.js';

import {
  printAttributes,
  printNodeFlags,
  printReferenceTag,
  printType,
} from '@bablr/agast-helpers/print';
import { isGapNode } from '@bablr/agast-helpers/path';

import './ContextPane.css';
import { getCooked, printString } from '@bablr/agast-helpers/tree';
import classNames from 'classnames';

function ContextPane() {
  let { selectionRoot, selectedRange, setSelectedRange } = useContext(SelectionContext);
  let { widths } = useContext(EditContext);

  let { 0: isOuter, 1: setIsOuter } = createSignal(false);

  let paneRoot = () => {
    const root = selectionRoot();

    return root && (isOuter() ? nodeBindings.get(nodeBindings.get(root).parentNode) : root);
  };

  let isGap = () => paneRoot() && isGapNode(paneRoot());

  let flags = () => {
    let { token, hasGap } = paneRoot().flags;
    return (
      <>
        <Show when={token}>*</Show>
        <Show when={hasGap}>$</Show>
      </>
    );
  };

  let selfClosing = () => {
    return paneRoot().flags.token;
  };

  let properties = () => {
    return Object.entries(paneRoot().properties).map(({ 0: key, 1: value }) => {
      if (Array.isArray(value)) {
        return (
          <div class="property">
            {`${key}:`} {value.length ? '[...]' : '[]'}
          </div>
        );
      } else {
        let { reference, node } = value;

        let intrinsicFrag =
          node.flags.token && !reference.value.flags.hasGap && !node.flags.hasGap
            ? ` ${printString(getCooked(node))}`
            : '';

        let selected = () => {
          return selectionRoot() === node;
        };

        let highlighted = () => {
          return (
            !selected() &&
            selectedRange()[0] === selectedRange()[1] &&
            nodeBindings.get(selectedRange()[0]) === node
          );
        };

        return (
          <div
            class={classNames({
              property: true,
              selected: selected(),
              highlighted: highlighted(),
            })}
          >
            <a
              class="reference"
              onClick={() => {
                let isSyntactic = !node.flags.hasGap && !reference.value.flags.hasGap;
                let htmlNode = nodeBindings.get(node);

                setSelectedRange([htmlNode, htmlNode]);

                setIsOuter(false);
              }}
            >
              {printReferenceTag(reference)}
            </a>{' '}
            <span
              class="node"
              onClick={() => {
                let htmlNode = nodeBindings.get(node);

                let isSyntactic = !node.flags.hasGap && !reference.value.flags.hasGap;

                setSelectedRange([htmlNode, htmlNode]);
                setIsOuter(!isSyntactic);
              }}
            >
              &lt;
              {printNodeFlags(node.flags)}
              {node.type.description}
              {intrinsicFrag} /&gt;
            </span>
          </div>
        );
      }
    });
  };

  return (
    <>
      <div class="context-pane">
        <Show when={paneRoot() && !isGap()}>
          <a
            class="property-name"
            onClick={() => {
              let htmlNode = nodeBindings.get(paneRoot());

              setSelectedRange([htmlNode, htmlNode]);
              setIsOuter(true);
            }}
          >
            {() => paneRoot() && nodeBindings.get(paneRoot()).dataset.path}:
          </a>
          <div
            class={classNames({ title: true, selected: !isOuter() })}
            onClick={() => {
              let htmlNode = nodeBindings.get(paneRoot());

              setSelectedRange([htmlNode, htmlNode]);
              setIsOuter(false);
            }}
          >
            {'<'}
            {flags}
            {() => printType(paneRoot()?.type)}
            {() => {
              const attributes_ = printAttributes(paneRoot()?.attributes);
              return attributes_ ? ` ${attributes_}` : '';
            }}
            {selfClosing() ? ' />' : '>'}
          </div>
          <div class="properties">{properties}</div>
          <div class={classNames({ title: true, selected: !isOuter() })}>
            {selfClosing() ? '' : '</>'}
          </div>
          <br />
          {/* <div>width: {() => widths.get(paneRoot())}</div> */}
        </Show>
        <Show when={isGap()}>
          <div class="property-name">
            {() => paneRoot() && nodeBindings.get(paneRoot()).dataset.path}:
          </div>
          <div class="title">{'<//>'}</div>
          <br />
          {/* <div>width: {() => widths.get(paneRoot())}</div> */}
        </Show>
      </div>
    </>
  );
}

export default ContextPane;
