// 镀锌板书架 / 材料柜：第一版为用户 GLB 实际几何展示，尚未拆分为可加工板材。
export const DEFAULT_SHEET_CONFIG = {
  schemaVersion: 1,
  kind: 'sheet',
  showGuides: false,
};
export const SHEET_ORIGINAL = Object.freeze({
  W: 4.3, H: 2.35, D: 0.6,
  sourceFile: '材料柜.glb',
  meshCount: 44,
  guideCount: 14,
  description: 'Rhino / SketchUp 材料柜原型，未进行结构参数化或工程下料核验',
});
