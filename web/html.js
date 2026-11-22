// html`...` builds markup and escapes every value in it, unless the value was itself built with html`...`.
// It's the only way the app writes markup (ESLint's no-unsanitized checks that).
class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }
// eslint-disable-next-line security/detect-object-injection -- c is one of the five characters in the regex
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const asHTML = (v) => (v instanceof SafeHTML ? v.s : Array.isArray(v) ? v.map(asHTML).join("") : v == null || v === false ? "" : esc(v));
// eslint-disable-next-line security/detect-object-injection -- i is the template literal's own index
export const html = (strings, ...vals) => new SafeHTML(strings.reduce((out, str, i) => out + str + (i < vals.length ? asHTML(vals[i]) : ""), ""));
