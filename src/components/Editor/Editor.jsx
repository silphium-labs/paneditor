import emptyStack from '@iter-tools/imm-stack';
import { useContext } from 'solid-js';
import { streamParse } from 'bablr';
import * as language from '@bablr/language-json';
import { SelectionContext, AgastContext } from '../../state/store.js';

import './Editor.css';

const initialCode = `[1, 2, 3]`;

function Editor() {
  const { selectedRange, setSelectedRange } = useContext(SelectionContext);
  const agastContext = useContext(AgastContext);

  const { tokens: tokens_ } = streamParse(
    language,
    'Expression',
    initialCode,
    {},
    { agastContext },
  );

  const nodeBindings = new WeakMap();

  const tokens = [...tokens_];

  const madness = tokens.reduce((stack, token) => {
    if (token.type === 'OpenNodeTag') {
      let ref = agastContext.getPreviousTerminal(token);

      while (ref && ref.type !== 'Reference') {
        ref = agastContext.getPreviousTerminal(ref);
      }

      stack = stack.push({ type: token.value.type, ref, fragment: <></> });
    }

    if (token.type === 'Literal' || (token.type === 'OpenNodeTag' && token.value.intrinsicValue)) {
      const value = token.type === 'Literal' ? token.value : token.value.intrinsicValue;
      stack = stack.replace({
        ref: stack.value.ref,
        type: stack.value.type,
        fragment: (
          <>
            {stack.value.fragment}
            {value}
          </>
        ),
      });
    }

    if (
      token.type === 'CloseNodeTag' ||
      (token.type === 'OpenNodeTag' && token.value.intrinsicValue)
    ) {
      const doneFrame = stack.value;
      let ref, type, fragment;

      stack = stack.pop();

      if (doneFrame.ref) {
        const node = agastContext.nodeForTag(token);
        const { flags } = node;
        const nodeValue = !(flags.trivia || flags.escape) ? (
          <span
            data-path={doneFrame.ref.value.name}
            {...() => {
              return selectedRange()[1] === token ? { class: 'selected' } : {};
            }}
          >
            {doneFrame.fragment}
          </span>
        ) : (
          <span>{doneFrame.fragment}</span>
        );

        nodeBindings.set(node, nodeValue);
        nodeBindings.set(nodeValue, node);

        ref = stack.value.ref;
        type = stack.value.type;
        fragment = nodeValue;
      } else {
        // capture the return value (an empty stack doesn't hold any data)
        ref = null;
        type = null;
        fragment = doneFrame.fragment;
      }

      stack = stack.replace({
        ref,
        type,
        fragment: (
          <>
            {stack.value.fragment}
            {fragment}
          </>
        ),
      });
    }

    return stack;
  }, emptyStack.push({ type: null, ref: null, fragment: <></> }));

  return (
    <>
      <div
        class="editor"
        onClick={(e) => {
          const token = nodeBindings.get(e.target);

          if (token) {
            setSelectedRange([token.openTag, token.closeTag || token.openTag]);
          } else {
            setSelectedRange([null, null]);
          }
        }}
      >
        {madness.value.fragment}
      </div>
    </>
  );
}

export default Editor;
