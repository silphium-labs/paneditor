/* global window */

import emptyStack from '@iter-tools/imm-stack';
import joinWith from 'iter-tools-es/methods/join-with';
import find from 'iter-tools-es/methods/find';
import { createEffect, useContext } from 'solid-js';
import { streamParse } from 'bablr';
import { spam } from '@bablr/boot';
import * as language from '@bablr/language-en-cstml-json';
import classNames from 'classnames';
import { evaluateIO } from '@bablr/io-vm-web';
import {
  SelectionContext,
  DocumentContext,
  BABLRContext,
  StoreContext,
  SumContext,
  nodeBindings,
} from '../../state/store.js';
import {
  get,
  buildStubNode,
  printReferenceTag,
  streamFromTree,
  traverseProperties,
  buildGapTag,
  evaluateReturnSync,
} from '@bablr/agast-helpers/tree';
import { isGapNode, isNullNode, Path, PathResolver, TagPath } from '@bablr/agast-helpers/path';
import * as btree from '@bablr/agast-helpers/btree';
import {
  ReferenceTag,
  OpenNodeTag,
  CloseNodeTag,
  LiteralTag,
  NullTag,
  ArrayInitializerTag,
  GapTag,
} from '@bablr/agast-helpers/symbols';
import { debugEnhancers } from '@bablr/helpers/enhancers';

import './Editor.css';
import { sourceFromTokenStream } from '@bablr/helpers/source';
import { buildString } from '@bablr/helpers/builders';

function* ancestors(node) {
  let parent = node;
  while (parent && nodeBindings.has(parent)) {
    yield parent;
    parent = parent.parentNode;
  }
}

const { isArray } = Array;

const computeStartPos = (node, widths) => {};

const buildChangeTemplate = (changedPath, newValue) => {
  let expressions = [];

  let ancestors_ = [...ancestors(changedPath)].reverse();
  let diffNodes = ancestors_.map((node) => ({
    ...nodeBindings.get(node),
    properties: {},
  }));

  const changedNode = nodeBindings.get(changedPath);

  let i = 0;
  let node = nodeBindings.get(ancestors_[0]);
  let resolver = new PathResolver();

  let stack = []; // { node, i, resolver }

  stack: for (;;) {
    let depth = stack.length;
    let diffNode = diffNodes[depth];
    let deeperNode = nodeBindings.get(ancestors_[depth + 1]);
    let deeperDiffNode = diffNodes[depth + 1];

    // use btree.getAt(idx) with a stack so that expressions are correct
    for (; i < btree.getSum(node.children); i++) {
      const child = btree.getAt(i, node.children);
      if (child.type === ReferenceTag) {
        const resolvedPath = resolver.advance(child);
        const childNode = get(node, resolvedPath);

        if (isArray(childNode)) continue;

        const path = nodeBindings.get(childNode);
        if (childNode === changedNode) {
          set(diffNode, resolvedPath, newValue);
        } else if (childNode === deeperNode) {
          set(diffNode, resolvedPath, deeperDiffNode);

          stack.push({ node, i: i + 1, resolver });

          node = childNode;
          i = 0;
          resolver = new PathResolver();
          continue stack;
        } else {
          if (path.dataset.path.endsWith('$')) {
            set(diffNode, resolvedPath, buildStubNode(buildGapTag()));
            expressions.push(childNode);
          } else {
            set(diffNode, resolvedPath, childNode);
          }
        }
      }
    }

    if (stack.length) {
      ({ node, i, resolver } = stack[stack.length - 1]);
      stack.pop();
    } else {
      return { source: sourceFromTokenStream(streamFromTree(diffNodes[0])), expressions };
    }
  }
};

export const getWidth = (node) => {
  if (isGapNode(node)) return 1;
  if (isNullNode(node)) return 0;

  return node.flags.token
    ? [...btree.traverse(node.children)].reduce((w, tag) => {
        switch (tag.type) {
          case LiteralTag:
            return w + tag.value.length;
          case ReferenceTag:
            throw new Error('unimplemented');
          default:
            return w;
        }
      }, 0)
    : reduceNode(
        node,
        (sum, node) => {
          return sum + getWidth(node);
        },
        0,
      );
};

const reduceNode = (node, reducer, initialValue) => {
  let acc = initialValue;
  for (const childNode of traverseProperties(node.properties)) {
    acc = reducer(acc, childNode);
  }
  return acc;
};

function Editor() {
  const { selectionRoot, selectedRange, setSelectedRange } = useContext(SelectionContext);
  const { document, setDocument } = useContext(DocumentContext);
  const { store, setStore } = useContext(StoreContext);
  const { widths } = useContext(SumContext);
  const bablrContext = useContext(BABLRContext);

  createEffect(() => {
    if (!store.editing) {
      window.getSelection().removeAllRanges();
    }
  });

  const matcher = spam`<$${buildString(language.canonicalURL)}:Expression />`;

  const madness = () => {
    const { expressions } = document();

    const tree = evaluateReturnSync(
      evaluateIO(() =>
        streamParse(
          bablrContext,
          matcher,
          document().source,
          {},
          { expressions, emitEffects: true, enhancers: debugEnhancers },
        ),
      ),
    );

    let stack = emptyStack.push({ type: null, node: null, fragment: null });

    let tagPath = TagPath.from(Path.from(tree), 0);

    while (tagPath) {
      let { tag, path } = tagPath;

      if (tag.type === OpenNodeTag) {
        if (tag.value.type) {
          const { node } = tagPath;
          const { type, flags } = tag.value;

          const newFrame = {
            type,
            node,
            fragment: <></>,
          };

          stack = stack.push(newFrame);
        } else {
          const { node } = tagPath;

          const newFrame = {
            type: null,
            node,
            fragment: <></>,
          };

          stack = stack.push(newFrame);
        }
      }

      if (tag.type === LiteralTag) {
        const { value } = tag;
        stack = stack.replace({
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

      if (tag.type === GapTag) {
        const { node: ownNode, reference } = path;

        const span = (
          <span
            class={classNames({ gap: true, selected: selectionRoot() === ownNode })}
            data-path={printReferenceTag(reference).slice(0, -1)}
          >
            &nbsp;
          </span>
        );

        nodeBindings.set(ownNode, span);
        nodeBindings.set(span, ownNode);
        widths.set(ownNode, 1);

        stack.value.fragment = (
          <>
            {stack.value.fragment}
            {span}
          </>
        );
      }

      if (tag.type === CloseNodeTag) {
        const doneFrame = stack.value;
        stack = stack.pop();

        if (path.depth) {
          let type, node, fragment;

          const { flags } = doneFrame.node;

          const { reference } = path;

          const referenceAttributes = {
            'data-type': doneFrame.node?.type.description,
            'data-path': printReferenceTag(reference).slice(0, -1),
          };

          const selected = () => {
            return selectionRoot() === doneFrame.node;
          };

          const contentEditable = () =>
            selected() && store.editing && flags.token ? { contenteditable: true } : {};

          const draggable = () =>
            selected() && store.selectionState === 'selected' ? { draggable: true } : {};

          const dragging = () => selected() && !!store.dragTarget;

          const span = (
            <span
              {...referenceAttributes}
              {...contentEditable()}
              {...draggable()}
              class={classNames({
                escape: reference.value.name === '@',
                token: flags.token,
                trivia: reference.value.name === '#',
                hasGap: flags.hasGap,
                selected: selected(),
                dragging: dragging(),
              })}
            >
              {doneFrame.fragment}
            </span>
          );

          nodeBindings.set(doneFrame.node, span);
          nodeBindings.set(span, doneFrame.node);
          widths.set(doneFrame.node, getWidth(doneFrame.node));

          node = stack.value.node;
          type = stack.value.type;
          fragment = span;

          stack = stack.replace({
            type,
            node,
            fragment: (
              <>
                {stack.value.fragment}
                {fragment}
              </>
            ),
          });
        } else {
          let { fragment } = doneFrame;

          // capture the return value (an empty stack doesn't hold any data)

          stack = stack.replace({
            type: null,
            node: stack.value.node,
            fragment: (
              <>
                {stack.value.fragment}
                {fragment}
              </>
            ),
          });
        }
      }

      tagPath = tagPath.nextUnshifted;
    }

    return stack;
  };

  return (
    <>
      <div
        class="editor"
        onMouseDown={(e) => {
          const tokenNode = nodeBindings.get(e.target);

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

          if (tokenNode) {
            setSelectedRange([tokenNode, tokenNode]);
          } else {
            setSelectedRange([null, null]);
          }
          setStore('selectionState', 'selecting');

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
                  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
                  selection.removeAllRanges();
                  if (range) range.collapse();
                  setStore('doubleClickRange', range);
                }
              });
            }
          }
        }}
        onMouseOver={(e) => {
          if (store.selectionState === 'selecting') {
            const tokenNode = nodeBindings.get(e.target);
            const selected = selectedRange();

            if (isGapNode(tokenNode)) {
              const startTokenNode = selected[0];
              setSelectedRange([startTokenNode, tokenNode]);
            } else if (tokenNode) {
              let range;

              const startTokenNode = selected[0];

              if (startTokenNode) {
                if (computeStartPos(tokenNode, widths) < computeStartPos(startTokenNode, widths)) {
                  range = [startTokenNode, tokenNode];
                } else {
                  range = [startTokenNode, tokenNode];
                }
              } else {
                range = [tokenNode, tokenNode];
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
            const token = nodeBindings.get(e.target);
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
          setStore('dragTarget', e.target);
        }}
        onDragOver={(e) => {
          const tokenNode = nodeBindings.get(e.target);

          if (isGapNode(tokenNode)) {
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault(); // allow drop
          }
        }}
        onDragEnd={(e) => {
          setStore('dragTarget', null);

          setStore('doubleClickTarget', null);

          window.document.getElementById('dragShadow').remove();
        }}
        onDrop={(e) => {
          const tokenNode = nodeBindings.get(e.target);

          e.preventDefault();

          if (isGapNode(tokenNode)) {
            const { dragTarget } = store;

            setDocument(buildChangeTemplate(e.target, nodeBindings.get(dragTarget)));

            dragTarget.parentNode.removeChild(dragTarget);

            e.target.replaceWith(dragTarget);
          }
        }}
      >
        {madness().value.fragment}
      </div>
    </>
  );
}

export default Editor;
