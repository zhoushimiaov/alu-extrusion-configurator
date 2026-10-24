// 镀锌板书架：Rhino 原模型 + 非破坏性的板厚/折边/连接件展示层。
// 此处的板厚与折边为视觉深化参数，不等于经校核的加工尺寸。
export const SHEET_THICKNESSES = Object.freeze([1, 1.5, 2]); // mm
export const SHEET_FINISHES = Object.freeze({
  zinc: { label: '锌灰金属' },
  satin: { label: '哑光锌灰' },
});
export const DEFAULT_SHEET_CONFIG = {
  schemaVersion: 2,
  kind: 'sheet',
  showGuides: false,
  thicknessMm: 1.5,
  folds: true,
  fasteners: true,
  finish: 'zinc',
};
export const SHEET_ORIGINAL = Object.freeze({
  W: 4.3, H: 2.35, D: 0.6,
  sourceFile: '材料柜.glb',
  meshCount: 44,
  guideCount: 14,
  description: 'Rhino / SketchUp 材料柜原型，显示厚度/折边为设计推演，未进行制造下料校核',
});
