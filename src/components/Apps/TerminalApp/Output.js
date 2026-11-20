export function* __Output({ output }) {
  yield '<div { class: "output" }>';
  yield* output();
  yield '</>';
}

let Output = ({ output }) => {
  return () => __Output({ output });
};

export default Output;
