// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');

const base = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

module.exports = [
  ...base,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
];
