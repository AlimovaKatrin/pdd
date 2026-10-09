export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-order'],
  ignoreFiles: [
    'dist/**',
    'node_modules/**',
    'coverage/**',
    'test-results/**',
    'playwright-report/**',
  ],
  rules: {
    // Separate component trees share HTML tags; keep each component's states together.
    'no-descending-specificity': null,
    'order/order': ['custom-properties', 'declarations'],
    'order/properties-alphabetical-order': true,
    'selector-class-pattern': '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
  },
};
