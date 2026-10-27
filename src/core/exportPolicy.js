// Manufacturing handoff policy shared by portable model export and assembly
// measurement. Display-only props must never become procurement geometry.
const DISPLAY_ONLY_NAMES = new Set(['props', 'displayBooks']);

export function isDisplayOnlyNode(node) {
  return node?.userData?.displayOnly === true || DISPLAY_ONLY_NAMES.has(node?.name);
}
