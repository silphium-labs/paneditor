const base = require('@bablr/eslint-config-base');
const pluginSyntaxJSX = require('@babel/plugin-syntax-jsx').default;

module.exports = {
  ...base,
  parserOptions: {
    ...base.parserOptions,
    babelOptions: {
      ...base.parserOptions.babelOptions,
      plugins: [...base.parserOptions.babelOptions.plugins, pluginSyntaxJSX],
    },
  },
};
