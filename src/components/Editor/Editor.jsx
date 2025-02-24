/* global window */

import emptyStack from '@iter-tools/imm-stack';
import joinWith from 'iter-tools-es/methods/join-with';
import find from 'iter-tools-es/methods/find';
import { createEffect, createRoot, useContext, runWithOwner, getOwner } from 'solid-js';
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
  EditContext,
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
  createNode,
  buildLiteralTag,
  treeFromStreamSync as treeFromStream,
} from '@bablr/agast-helpers/tree';
import { add, isGapNode, isNullNode, Path, TagPath } from '@bablr/agast-helpers/path';
import * as btree from '@bablr/agast-helpers/btree';
import {
  ReferenceTag,
  OpenNodeTag,
  CloseNodeTag,
  LiteralTag,
  GapTag,
  EmbeddedNode,
  ShiftTag,
} from '@bablr/agast-helpers/symbols';
import { debugEnhancers } from '@bablr/helpers/enhancers';

import './Editor.css';
import { sourceFromTokenStream } from '@bablr/helpers/source';
import { buildString } from '@bablr/helpers/builders';

// TODO this is a horrible horrible hack
// we need to manage ownership better to keep the nodes alive only as long as they are really used
let solidRoot;
createRoot(() => {
  solidRoot = getOwner();
});

function* ancestors(node) {
  let parent = node;
  while (parent && nodeBindings.has(parent)) {
    yield parent;
    parent = parent.parentNode;
  }
}

const computeStartPos = (node, widths) => {};

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
  let { selectionRoot, selectedRange, setSelectedRange } = useContext(SelectionContext);
  let { document, setDocument } = useContext(DocumentContext);
  let { store, setStore } = useContext(StoreContext);
  let { widths, editStates } = useContext(EditContext);
  let bablrContext = useContext(BABLRContext);

  createEffect(() => {
    if (!store.editing) {
      window.getSelection().removeAllRanges();
    }
  });

  let matcher = spam`<$${buildString(language.canonicalURL)}:Expression />`;

  let fragment = () => {
    let { expressions } = document();

    let tree = evaluateReturnSync(
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
        let { path, node } = tagPath;
        let { type, flags } = tag.value;

        let existingHtmlNode = nodeBindings.get(node);

        if (existingHtmlNode) {
          stack.value.fragment = (
            <>
              {stack.value.fragment}
              {existingHtmlNode}
            </>
          );
          tagPath = TagPath.from(path, -1);
        } else {
          stack = stack.push({
            type,
            node,
            fragment: <></>,
          });
        }
      }

      if (tag.type === LiteralTag) {
        let { value } = tag;
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
        let { node: ownNode, reference } = path;

        // prettier-ignore
        let span = (
          <span
            class={classNames({ node: true, gap: true, selected: selectionRoot() === ownNode })}
            data-path={printReferenceTag(reference).slice(0, -1)}
          >&nbsp;&nbsp;</span>
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
        let doneFrame = stack.value;
        stack = stack.pop();

        let fragment;

        if (path.depth) {
          let { flags } = doneFrame.node;

          let { reference } = path;

          let span = runWithOwner(solidRoot, () => {
            let referenceAttributes = {
              'data-type': doneFrame.node?.type.description,
              'data-path': printReferenceTag(reference).slice(0, -1),
            };

            let selected = () => {
              return selectionRoot() === doneFrame.node;
            };

            let highlighted = () => {
              return (
                !selected() &&
                selectedRange()[0] === selectedRange()[1] &&
                nodeBindings.get(selectedRange()[0]) === doneFrame.node
              );
            };

            let contentEditable = () =>
              selected() && store.editing && flags.token ? { contenteditable: true } : {};

            let draggable = () =>
              !store.editing && selected() && store.selectionState === 'selected'
                ? { draggable: true }
                : {};

            let dragging = () => selected() && !!store.dragTarget;

            return (
              <span
                {...referenceAttributes}
                {...contentEditable()}
                {...draggable()}
                class={classNames({
                  node: true,
                  escape: reference.value.name === '@',
                  token: flags.token,
                  trivia: reference.value.name === '#',
                  hasGap: flags.hasGap,
                  selected: selected(),
                  highlighted: highlighted(),
                  dragging: dragging(),
                })}
              >
                {doneFrame.fragment}
              </span>
            );
          });

          nodeBindings.set(doneFrame.node, span);
          nodeBindings.set(span, doneFrame.node);
          widths.set(doneFrame.node, getWidth(doneFrame.node));

          fragment = span;
        } else {
          ({ fragment } = doneFrame);

          // capture the return value (an empty stack doesn't hold any data)
        }

        stack.value.fragment = (
          <>
            {stack.value.fragment}
            {fragment}
          </>
        );
      }

      tagPath = tagPath.nextUnshifted;
    }

    return stack.value.fragment;
  };

  const doMove = (sourceHtmlNode, destHtmlNode) => {
    let newValue = nodeBindings.get(sourceHtmlNode);
    let changedNode = nodeBindings.get(destHtmlNode);
    let expressions = [];

    let destAncestors = [...ancestors(destHtmlNode)].reverse();
    let sourceAncestors = [...ancestors(sourceHtmlNode)].reverse();

    let tagPath = TagPath.from(Path.from(nodeBindings.get(destAncestors[0])), 0);
    let diffPath = Path.from(createNode());
    let rootDiffPath = diffPath;

    while (tagPath) {
      let { tag, path } = tagPath;
      let { depth } = path;
      let deeperSourceNode = nodeBindings.get(sourceAncestors[depth + 1]);
      let deeperDestNode = nodeBindings.get(destAncestors[depth + 1]);

      if (tag.type === GapTag) {
        let reference = tagPath.previousSibling.tag;

        if (reference.type === ShiftTag) {
          throw new Error('umimplemented');
        }

        let childNode = tagPath.inner;

        if (childNode === changedNode) {
          add(diffPath.node, reference, newValue);
        } else if (childNode === newValue) {
          add(diffPath.node, reference, buildStubNode(buildGapTag()));
          expressions.unshift(buildStubNode(buildGapTag()));
        } else if (childNode === deeperDestNode || childNode === deeperSourceNode) {
          let newNode = createNode();
          add(diffPath.node, reference, newNode);

          diffPath = diffPath.push(newNode, btree.getSum(diffPath.node.children) - 2);
          tagPath = TagPath.from(tagPath.innerPath, 0);
          continue;
        } else {
          let htmlNode = nodeBindings.get(childNode);

          if (htmlNode?.dataset.path.endsWith('$')) {
            add(diffPath.node, reference, buildStubNode(buildGapTag()));
            expressions.unshift(childNode);
          } else {
            add(diffPath.node, reference, childNode);
          }
        }
      } else if (tag.type === EmbeddedNode) {
        let reference = tagPath.previousSibling.tag;
        add(diffPath.node, reference, tag.value);
      } else if (tag.type === CloseNodeTag) {
        diffPath.node.children = btree.push(diffPath.node.children, tag);
      } else if (tag.type === OpenNodeTag) {
        diffPath.node.children = btree.push(diffPath.node.children, tag);
        diffPath.node.flags = tag.value.flags;
        diffPath.node.type = tag.value.type;
        diffPath.node.language = tag.value.language;
        diffPath.node.attributes = tag.value.attributes;
      }

      if (!tagPath.nextSibling) {
        tagPath = tagPath.nextUnshifted;
        diffPath = diffPath.parent;
      } else {
        tagPath = tagPath.nextSibling;
      }
    }

    setDocument({ source: sourceFromTokenStream(streamFromTree(rootDiffPath.node)), expressions });
  };

  const doSet = (destHtmlNode, newValue) => {
    let changedNode = nodeBindings.get(destHtmlNode);
    let expressions = [];

    let destAncestors = [...ancestors(destHtmlNode)].reverse();

    let tagPath = TagPath.from(Path.from(nodeBindings.get(destAncestors[0])), 0);
    let diffPath = Path.from(createNode());
    let rootDiffPath = diffPath;

    while (tagPath) {
      let { tag, path } = tagPath;
      let { depth } = path;
      let deeperDestNode = nodeBindings.get(destAncestors[depth + 1]);

      if (tag.type === GapTag) {
        let reference = tagPath.previousSibling.tag;

        if (reference.type === ShiftTag) {
          throw new Error('umimplemented');
        }

        let childNode = tagPath.inner;

        if (childNode === changedNode) {
          add(diffPath.node, reference, newValue);
        } else if (childNode === newValue) {
          add(diffPath.node, reference, buildStubNode(buildGapTag()));
          expressions.unshift(buildStubNode(buildGapTag()));
        } else if (childNode === deeperDestNode) {
          let newNode = createNode();
          add(diffPath.node, reference, newNode);

          diffPath = diffPath.push(newNode, btree.getSum(diffPath.node.children) - 2);
          tagPath = TagPath.from(tagPath.innerPath, 0);
          continue;
        } else {
          let htmlNode = nodeBindings.get(childNode);

          if (htmlNode?.dataset.path.endsWith('$')) {
            add(diffPath.node, reference, buildStubNode(buildGapTag()));
            expressions.unshift(childNode);
          } else {
            add(diffPath.node, reference, childNode);
          }
        }
      } else if (tag.type === EmbeddedNode) {
        let reference = tagPath.previousSibling.tag;
        add(diffPath.node, reference, tag.value);
      } else if (tag.type === CloseNodeTag) {
        diffPath.node.children = btree.push(diffPath.node.children, tag);
      } else if (tag.type === OpenNodeTag) {
        diffPath.node.children = btree.push(diffPath.node.children, tag);
        diffPath.node.flags = tag.value.flags;
        diffPath.node.type = tag.value.type;
        diffPath.node.language = tag.value.language;
        diffPath.node.attributes = tag.value.attributes;
      }

      if (!tagPath.nextSibling) {
        tagPath = tagPath.nextUnshifted;
        diffPath = diffPath.parent;
      } else {
        tagPath = tagPath.nextSibling;
      }
    }

    setDocument({ source: sourceFromTokenStream(streamFromTree(rootDiffPath.node)), expressions });
  };

  const handlers = {
    onMouseDown: (e) => {
      let tokenNode = nodeBindings.get(e.target);

      let oldDoubleClickTarget = store.doubleClickTarget;
      let oldSelectedRange = selectedRange();
      let isDoubleClick = oldDoubleClickTarget === e.target;

      if (store.doubleClickTimeout) window.clearTimeout(store.doubleClickTimeout);

      if (!isDoubleClick) {
        setStore('doubleClickTarget', e.target);

        setStore(
          'doubleClickTimeout',
          window.setTimeout(() => {
            setStore('doubleClickTarget', null);
            setStore('doubleClickTimeout', null);
          }, 300),
        );
      } else {
        setStore('doubleClickTarget', null);
        setStore('doubleClickTimeout', null);
      }

      // if (store.selectionState === 'selected') debugger;
      if (
        store.selectionState === 'selected' &&
        find((node) => node.draggable, ancestors(e.target)) &&
        !isDoubleClick
      ) {
        if (tokenNode) {
          setSelectedRange([e.target, e.target]);
        } else {
          setSelectedRange([null, null]);
        }
        return;
      }

      if (!store.touchTimeout && oldDoubleClickTarget && !store.editing) {
        e.preventDefault();
      }

      let selection = window.getSelection();

      let isEditModeClick =
        store.editing && e.target.contentEditable && e.target === selectedRange()[0];

      if (!isEditModeClick) {
        if (!store.touchTimeout) {
          if (tokenNode) {
            setSelectedRange([e.target, e.target]);
          } else {
            setSelectedRange([null, null]);
          }
          setStore('selectionState', 'selecting');
        }

        if (store.editing && !store.touchTimeout) {
          const selected = oldSelectedRange;

          if (selected[0] !== selected[1]) throw new Error();

          let token = nodeBindings.get(selected[0]);

          if (!token.flags.token) throw new Error();

          // this prevents you double clicking on a different node to enter its edit mode
          // as you leave your edit mode, the target changes
          doSet(
            selected[0],
            treeFromStream([
              btree.getAt(0, token.children),
              buildLiteralTag(selected[0].innerText),
              btree.getAt(-1, token.children),
            ]),
          );

          setStore('editing', false);
        }

        if (isDoubleClick) {
          let range = store.doubleClickRange;

          if (!store.touchTimeout) {
            setStore('editing', true);
          }
          setStore('doubleClickRange', null);

          selection.removeAllRanges();
          if (range) selection.addRange(range);

          e.preventDefault();
        } else {
          window.setTimeout(() => {
            if (store.doubleClickTarget) {
              let range = selection.rangeCount ? selection.getRangeAt(0) : null;
              selection.removeAllRanges();
              if (range) range.collapse();
              setStore('doubleClickRange', range);
            }
          });
        }
      }
    },
    onTouchStart: (e) => {
      let tokenNode = nodeBindings.get(e.target);

      setStore('touchTarget', e.target);
      setStore(
        'touchTimeout',
        window.setTimeout(() => {
          if (store.touchTimeout) window.clearTimeout(store.touchTimeout);
          setStore('touchTimeout', null);
        }, 300),
      );

      let oldDoubleTouchTarget = store.doubleTouchTarget;
      let oldSelectedRange = selectedRange();

      let isDoubleTouch = oldDoubleTouchTarget === e.target;

      if (!isDoubleTouch) {
        setStore('doubleTouchTarget', e.target);

        setStore(
          'doubleTouchTimeout',
          window.setTimeout(() => {
            if (store.doubleTouchTimeout) window.clearTimeout(store.doubleTouchTimeout);
            setStore('doubleTouchTarget', null);
            setStore('doubleTouchTimeout', null);
          }, 300),
        );
      } else {
        window.clearTimeout(store.doubleTouchTimeout);

        setStore('doubleTouchTarget', null);
        setStore('doubleTouchTimeout', null);
      }

      if (
        store.selectionState === 'selected' &&
        find((node) => node.draggable, ancestors(e.target)) &&
        !isDoubleTouch
      ) {
        return;
      }

      // if ((oldDoubleTouchTarget || !tokenNode) && !store.editing) {
      //   e.preventDefault();
      // }

      if (!store.editing) {
        if (tokenNode) {
          setSelectedRange([e.target, e.target]);
        } else {
          setSelectedRange([null, null]);
        }
        setStore('selectionState', 'selecting');
      }

      let isEditModeTouch =
        store.editing && e.target.contentEditable && e.target === selectedRange()[0];

      if (!isEditModeTouch) {
        if (store.editing) {
          const selected = oldSelectedRange;

          if (selected[0] !== selected[1]) throw new Error();

          let token = nodeBindings.get(selected[0]);

          if (!token.flags.token) throw new Error();

          doSet(
            selected[0],
            treeFromStream([
              btree.getAt(0, token.children),
              buildLiteralTag(selected[0].innerText),
              btree.getAt(-1, token.children),
            ]),
          );

          setStore('editing', false);
        }

        if (isDoubleTouch) {
          setStore('editing', true);

          // e.preventDefault();
        }
      }
    },
    onMouseOver: (e) => {
      if (store.touchTimeout) {
        e.preventDefault();
        return;
      }

      if (store.selectionState === 'selecting') {
        let tokenNode = nodeBindings.get(e.target);
        let selected = selectedRange();

        if (isGapNode(tokenNode)) {
          let startTokenNode = selected[0];
          setSelectedRange([startTokenNode, e.target]);
        } else if (tokenNode) {
          let range;

          let startTokenNode = selected[0];

          if (startTokenNode) {
            if (computeStartPos(tokenNode, widths) < computeStartPos(startTokenNode, widths)) {
              range = [startTokenNode, e.target];
            } else {
              range = [startTokenNode, e.target];
            }
          } else {
            range = [e.target, e.target];
          }

          setSelectedRange(range);
        } else {
          setSelectedRange([selectedRange()[0], selectedRange()[0]]);
        }
      }
    },
    onTouchMove: (e) => {
      setStore(
        'touchTimeout',
        window.setTimeout(() => {
          if (store.touchTimeout) window.clearTimeout(store.touchTimeout);
          setStore('touchTimeout', null);
        }, 300),
      );

      if (e.touches.length === 1) {
        let touch = e.touches[0];

        let target = window.document.elementFromPoint(touch.clientX, touch.clientY);

        if (target !== store.touchTarget) {
          setStore('touchTarget', target);

          if (store.selectionState === 'selecting') {
            let tokenNode = nodeBindings.get(target);
            let selected = selectedRange();

            if (isGapNode(tokenNode)) {
              let startTokenNode = selected[0];
              setSelectedRange([startTokenNode, target]);
            } else if (tokenNode) {
              let range;

              let startTokenNode = selected[0];

              if (startTokenNode) {
                if (computeStartPos(tokenNode, widths) < computeStartPos(startTokenNode, widths)) {
                  range = [startTokenNode, target];
                } else {
                  range = [startTokenNode, target];
                }
              } else {
                range = [target, target];
              }

              setSelectedRange(range);
            } else {
              setSelectedRange([selectedRange()[0], selectedRange()[0]]);
            }
          }
        }
      }
    },
    onKeyDown: (e) => {
      if (e.key === 'Escape') {
        setStore('editing', false);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        // TODO implement other ways (e.g. touch) to accept edits
        const selected = selectedRange();

        if (selected[0] !== selected[1]) throw new Error();

        let token = nodeBindings.get(selected[0]);

        if (!token.flags.token) throw new Error();

        doSet(
          selected[0],
          treeFromStream([
            btree.getAt(0, token.children),
            buildLiteralTag(selected[0].innerText),
            btree.getAt(-1, token.children),
          ]),
        );

        setStore('editing', false);
        e.preventDefault();
      }
    },
    onMouseOut: (e) => {
      if (store.touchTimeout) {
        e.preventDefault();
        return;
      }
      if (store.selectionState === 'selecting') {
        let token = nodeBindings.get(e.target);
        if (!token) {
          setSelectedRange([selectedRange()[0], selectedRange()[0]]);
        }
      }
    },
    onMouseUp: (e) => {
      if (store.touchTimeout) {
        return;
      }
      setStore('selectionState', selectedRange() ? 'selected' : 'none');

      if (e.target !== store.doubleClickTarget) {
        window.clearTimeout(store.doubleClickTimeout);

        setStore('doubleClickTarget', null);
        setStore('doubleClickTimeout', null);
      }
    },

    onTouchEnd: (e) => {
      setStore(
        'touchTimeout',
        window.setTimeout(() => {
          if (store.touchTimeout) window.clearTimeout(store.touchTimeout);
          setStore('touchTimeout', null);
        }, 300),
      );

      setStore('touchTarget', null);

      setStore('selectionState', selectedRange() ? 'selected' : 'none');
    },
    onDragStart: (e) => {
      let clone = e.target.cloneNode(true);
      clone.id = 'dragShadow';
      window.document.body.appendChild(clone);
      e.dataTransfer.setDragImage(clone, 0, 0);
      setStore('dragTarget', e.target);
    },
    onDragOver: (e) => {
      let tokenNode = nodeBindings.get(e.target);

      if (isGapNode(tokenNode)) {
        e.dataTransfer.dropEffect = 'move';
        e.preventDefault(); // allow drop
      }
    },
    onDragEnd: (e) => {
      if (store.dragTarget) {
        setStore('dragTarget', null);
        setStore('doubleClickTarget', null);

        window.document.getElementById('dragShadow').remove();
      }
    },
    onDrop: (e) => {
      let tokenNode = nodeBindings.get(e.target);

      e.preventDefault();

      if (isGapNode(tokenNode)) {
        let { dragTarget } = store;

        doMove(dragTarget, e.target);

        dragTarget.parentNode.removeChild(dragTarget);

        setStore('dragTarget', null);
        setStore('doubleClickTarget', null);

        window.document.getElementById('dragShadow').remove();

        e.target.replaceWith(dragTarget);
      }
    },
  };

  return (
    <>
      <div
        class="editor"
        onMouseDown={handlers.onMouseDown}
        onTouchStart={handlers.onTouchStart}
        onMouseOver={handlers.onMouseOver}
        onTouchMove={handlers.onTouchMove}
        onKeyDown={handlers.onKeyDown}
        onMouseOut={handlers.onMouseOut}
        onTouchEnd={handlers.onTouchEnd}
        onTouchCancel={handlers.onTouchEnd}
        onMouseUp={handlers.onMouseUp}
        onDragStart={handlers.onDragStart}
        onDragOver={handlers.onDragOver}
        onDragEnd={handlers.onDragEnd}
        onDrop={handlers.onDrop}
      >
        {fragment()}
      </div>
    </>
  );
}

export default Editor;
