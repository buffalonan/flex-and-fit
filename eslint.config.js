// Lints the web app for bugs and unsafe DOM writes, and the server and scripts for risky Node patterns.
const js = require("@eslint/js");
const html = require("eslint-plugin-html");
const nounsanitized = require("eslint-plugin-no-unsanitized");
const security = require("eslint-plugin-security");
const globals = require("globals");

const unsanitized = {
  // Markup is only written through the html`...` tag, which escapes every value.
  "no-unsanitized/property": ["error", { escape: { taggedTemplates: ["html"] } }],
  "no-unsanitized/method": ["error", { escape: { taggedTemplates: ["html"] } }],
};

module.exports = [
  { ignores: ["node_modules/", "playwright-report/", "test-results/", "www/", "_site/", "android/", "data/", "prototypes/", "web/vendor/"] },
  js.configs.recommended,
  { rules: { "no-unused-vars": ["error", { caughtErrors: "none" }] } },
  {
    files: ["**/*.html"],
    plugins: { html, "no-unsanitized": nounsanitized },
    languageOptions: { ecmaVersion: 2024, sourceType: "script", globals: { ...globals.browser } },
    rules: unsanitized,
  },
  {
    files: ["web/**/*.js"],
    plugins: { "no-unsanitized": nounsanitized, security },
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser } },
    rules: { ...unsanitized, ...security.configs.recommended.rules },
  },
  {
    files: ["server/**/*.js", "scripts/**/*.js", "tests/**/*.js", "android-tests/**/*.js", "*.config.js"],
    plugins: { security },
    languageOptions: { ecmaVersion: 2024, sourceType: "commonjs", globals: { ...globals.node } },
    rules: { ...security.configs.recommended.rules },
  },
  {
    // Build scripts and tests: paths come from this repo, not from users.
    files: ["scripts/**/*.js", "tests/**/*.js", "server/*.test.js"],
    rules: { "security/detect-non-literal-fs-filename": "off", "security/detect-object-injection": "off", "security/detect-child-process": "off" },
  },
  {
    // Code inside page.evaluate() runs in the page.
    files: ["tests/**/*.js", "android-tests/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
];
