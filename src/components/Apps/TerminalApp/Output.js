import { isValidNode } from 'agast';

export function* __Output({ output }) {
  yield '<div { class: "output" }>';

  if (isValidNode(output())) {
    yield output();
  } else if (output()) {
    yield* output();
  }

  yield '</>';
}

let Output = ({ output }) => {
  return () => __Output({ output });
};

export default Output;
