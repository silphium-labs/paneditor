/* global window */

import emptyStack from '@iter-tools/imm-stack';
import joinWith from 'iter-tools-es/methods/join-with';
import find from 'iter-tools-es/methods/find';
import { createEffect, useContext } from 'solid-js';
import { streamParse } from 'bablr';
import * as language from '@bablr/language-en-json';
import classNames from 'classnames';
import { SelectionContext, AgastContext, StoreContext, SumContext } from '../../state/store.js';
import { Resolver } from '@bablr/agast-helpers/tree';
import { embeddedSourceFrom } from '@bablr/helpers/source';

import './Editor.css';

function* ancestors(node) {
  let parent = node;
  while (parent) {
    yield parent;
    parent = parent.parentNode;
  }
}

const computeStartPos = (node, widths) => {};

const initialCode = embeddedSourceFrom(
  `'[\n  1, 2, -33,\n  444, {\n    "num": 5555,\n    "str": "hello world",\n    "gap": '<//>'\n  }\n]'`,
);

const get = (node, path) => {
  const { 1: name, 2: index } = /^([^\.]+)(?:\.(\d+))?/.exec(path) || [];

  if (index != null) {
    return node.properties.get(name)?.[parseInt(index, 10)];
  } else {
    return node.properties.get(name);
  }
};

const reduceNode = (agastContext, node, reducer, initialValue) => {
  const resolver = new Resolver(node);
  let acc = initialValue;
  for (const terminal of agastContext.ownTerminalsFor(node.range)) {
    if (terminal.type === 'Reference') {
      const range = get(node, resolver.consume(terminal).resolve(terminal));
      if (range) {
        acc = reducer(acc, range);
      }
    }
  }
  return acc;
};

function Editor() {
  const { selectionRoot, selectedRange, setSelectedRange } = useContext(SelectionContext);
  const { store, setStore } = useContext(StoreContext);
  const { widths } = useContext(SumContext);
  const agastContext = useContext(AgastContext);

  createEffect(() => {
    if (!store.editing) {
      window.getSelection().removeAllRanges();
    }
  });

  const { tokens: tokens_ } = streamParse(
    language,
    'Expression',
    initialCode,
    {},
    { agastContext },
  );

  const pathBindings = new WeakMap();

  const tokens = [...tokens_];

  const madness = tokens.reduce((stack, token) => {
    if (token.type === 'Reference') {
      let path = agastContext.pathForTag(token);

      stack = stack.push({ type: null, path, node: null, fragment: null });
    }

    if (token.type === 'OpenNodeTag') {
      let ref = agastContext.getPreviousTerminal(token);
      const node = agastContext.nodeForTag(token);
      const { type, flags } = token.value;

      while (ref && ref.type !== 'Reference') {
        ref = agastContext.getPreviousTerminal(ref);
      }

      const path = flags.escape || flags.trivia ? agastContext.pathForTag(token) : stack.value.path;

      const newFrame = {
        type,
        path,
        node,
        fragment: <></>,
      };

      if (type && !(flags.escape || flags.trivia)) {
        stack = stack.replace(newFrame);
      } else {
        stack = stack.push(newFrame);
      }
    }

    if (token.type === 'Literal' || (token.type === 'OpenNodeTag' && token.value.intrinsicValue)) {
      const value = token.type === 'Literal' ? token.value : token.value.intrinsicValue;
      stack = stack.replace({
        path: stack.value.path,
        node: stack.value.node,
        type: stack.value.type,
        fragment: (
          <>
            {stack.value.fragment}
            {[...joinWith(<br />, value.replace(/ /g, '\u00a0').split('\n'))]}
          </>
        ),
      });
    }

    if (token.type === 'Null') {
      stack = stack.pop();
    }

    if (token.type === 'Gap') {
      const ownPath = stack.value.path;
      const span = (
        <span class={classNames({ gap: true, selected: selectionRoot() === ownPath })}>&nbsp;</span>
      );

      pathBindings.set(stack.value.path, span);
      pathBindings.set(span, stack.value.path);

      stack = stack.pop();

      stack.value.fragment = (
        <>
          {stack.value.fragment}
          {span}
        </>
      );
    }

    if (
      token.type === 'CloseNodeTag' ||
      (token.type === 'OpenNodeTag' && token.value.intrinsicValue)
    ) {
      const doneFrame = stack.value;
      let path, type, node, fragment;

      stack = stack.pop();

      if (stack.size > 1) {
        const { flags } = doneFrame.node;

        const referenceAttributes = !(flags.trivia || flags.escape)
          ? {
              'data-type': doneFrame.node?.type,
              'data-path': doneFrame.path.reference?.value.name,
            }
          : {};

        const selected = () => {
          return selectionRoot() === doneFrame.path;
        };

        const contentEditable = () =>
          selected() && store.editing && flags.token ? { contenteditable: true } : {};

        const draggable = () =>
          selected() && store.selectionState === 'selected' ? { draggable: true } : {};

        const dragging = () => selected() && store.dragState === 'dragging';

        const span = (
          <span
            {...referenceAttributes}
            {...contentEditable()}
            {...draggable()}
            class={classNames({
              escape: flags.escape,
              token: flags.token,
              trivia: flags.trivia,
              intrinsic: flags.intrinsic,
              selected: selected(),
              dragging: dragging(),
            })}
          >
            {doneFrame.fragment}
          </span>
        );

        const width = flags.token
          ? [...agastContext.ownTerminalsFor(doneFrame.node.range)].reduce((w, terminal) => {
              switch (terminal.type) {
                case 'OpenNodeTag':
                  return w + (terminal.value.intrinsicValue?.length || 0);
                case 'Literal':
                  return w + terminal.value.length;
                case 'Reference':
                  throw new Error('unimplemented');
                default:
                  return w;
              }
            }, 0)
          : reduceNode(
              agastContext,
              doneFrame.node,
              (sum, range) => {
                return sum + widths.get(agastContext.nodeForTag(range[0]));
              },
              0,
            );

        pathBindings.set(doneFrame.path, span);
        pathBindings.set(span, doneFrame.path);
        widths.set(doneFrame.node, width);

        path = stack.value.path;
        node = stack.value.node;
        type = stack.value.type;
        fragment = span;
      } else {
        // capture the return value (an empty stack doesn't hold any data)
        path = null;
        type = null;
        fragment = doneFrame.fragment;
      }

      stack = stack.replace({
        path,
        type,
        node,
        fragment: (
          <>
            {stack.value.fragment}
            {fragment}
          </>
        ),
      });
    }

    return stack;
  }, emptyStack.push({ type: null, path: null, node: null, fragment: null }));

  return (
    <>
      <div
        class="editor"
        onMouseDown={(e) => {
          const tokenPath = pathBindings.get(e.target);
          const tokenNode = agastContext.nodeForPath(tokenPath);

          const oldDoubleClickTarget = store.doubleClickTarget;

          if (!oldDoubleClickTarget) {
            setStore('doubleClickTarget', e.target);

            window.setTimeout(() => setStore('doubleClickTarget', null), 300);
          } else {
            setStore('doubleClickTarget', null);
          }

          // if (store.selectionState === 'selected') debugger;
          if (
            store.selectionState === 'selected' &&
            find((node) => node.draggable, ancestors(e.target)) &&
            !oldDoubleClickTarget
          ) {
            return;
          }

          if ((oldDoubleClickTarget || !tokenNode) && !store.editing) {
            e.preventDefault();
          }

          if (tokenPath && agastContext.getNextTerminal(tokenPath.reference)?.type === 'Gap') {
            const gapToken = agastContext.getNextTerminal(tokenPath.reference);
            setSelectedRange([gapToken, gapToken]);
          } else {
            if (tokenNode) {
              setSelectedRange([tokenNode.openTag, tokenNode.closeTag]);
            } else {
              setSelectedRange([null, null]);
            }
            setStore('selectionState', 'selecting');
          }

          const selection = window.getSelection();

          const isEditModeClick =
            store.editing &&
            e.target.contentEditable &&
            e.target === selection?.focusNode?.parentElement;

          if (!isEditModeClick) {
            if (store.editing) {
              setStore('editing', false);
            }

            if (oldDoubleClickTarget && e.target === oldDoubleClickTarget) {
              const range = store.doubleClickRange;

              setStore('editing', true);
              setStore('doubleClickRange', null);

              selection.removeAllRanges();
              selection.addRange(range);

              e.preventDefault();
            } else {
              window.setTimeout(() => {
                if (store.doubleClickTarget) {
                  const range = selection.getRangeAt(0);
                  selection.removeAllRanges();
                  range.collapse();
                  setStore('doubleClickRange', range);
                }
              });
            }
          }
        }}
        onMouseOver={(e) => {
          if (store.selectionState === 'selecting') {
            const tokenPath = pathBindings.get(e.target);
            const tokenNode = agastContext.nodeForPath(tokenPath);
            const selected = selectedRange();

            if (tokenPath && agastContext.getNextTerminal(tokenPath.reference)?.type === 'Gap') {
              const gapToken = agastContext.getNextTerminal(tokenPath.reference);
              const startTokenNode = agastContext.nodeForTag(selected[0]);
              setSelectedRange([startTokenNode.openTag, gapToken]);
            } else if (tokenNode) {
              let { openTag, closeTag } = tokenNode;
              let range;

              const startTokenNode = agastContext.nodeForTag(selected[0]);

              if (startTokenNode) {
                if (computeStartPos(tokenNode, widths) < computeStartPos(startTokenNode, widths)) {
                  range = [startTokenNode.closeTag, openTag];
                } else {
                  range = [startTokenNode.openTag, closeTag];
                }
              } else {
                range = [openTag, closeTag];
              }

              setSelectedRange(range);
            } else {
              setSelectedRange([selectedRange()[0], selectedRange()[0]]);
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setStore('editing', false);
          }

          e.preventDefault();
        }}
        onMouseOut={(e) => {
          if (store.selectionState === 'selecting') {
            const token = agastContext.nodeForPath(pathBindings.get(e.target));
            if (!token) {
              setSelectedRange([selectedRange()[0], selectedRange()[0]]);
            }
          }
        }}
        onMouseUp={(e) => {
          setStore('selectionState', selectedRange() ? 'selected' : 'none');

          if (e.target !== store.doubleClickTarget) {
            setStore('doubleClickTarget', null);
          }
        }}
        onDragStart={(e) => {
          const clone = e.target.cloneNode(true);
          clone.id = 'dragShadow';
          window.document.body.appendChild(clone);
          e.dataTransfer.setDragImage(clone, 0, 0);
          setStore('dragState', 'dragging');
        }}
        onDragOver={(e) => {
          const tokenPath = pathBindings.get(e.target);

          if (tokenPath && agastContext.getNextTerminal(tokenPath.reference)?.type === 'Gap') {
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault(); // allow drop
          }
        }}
        onDragEnd={(e) => {
          setStore('dragState', 'none');

          setStore('doubleClickTarget', null);

          window.document.getElementById('dragShadow').remove();
        }}
      >
        {madness.value.fragment}
      </div>
    </>
  );
}

export default Editor;
