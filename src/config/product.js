// 产品配置唯一来源：改这里即可扩展默认值、限制、型材、层板、配色与示例价格
export const LIMITS = { bays: [2, 8], levels: [2, 8], bayWidth: [0.3, 1.2] };

export const DEFAULT_BAY_WIDTH = 0.57;

export const DEFAULT_CONFIG = {
  schemaVersion: 2,
  bays: 6,
  levels: 6,
  series: '2040',
  frameMode: 'glb', // 'standard' | 'glb'：GLB同构装配，价格未知项单独提示
  decks: null,        // 逐层层板数组 ['rib'|'acrylic'|'none']，null 时按 levels 全 'rib'
  backs: null,        // 逐层背板数组 ['panel'|'none']，null 时按 levels 全 'panel'
  bayWidths: null,    // 逐跨宽度数组（米），null 时按 bays 全 DEFAULT_BAY_WIDTH
  sidePanels: true,
  panelColor: 'galv', // 背板配色，见 PANEL_COLORS
  props: true,      // 摆件示例（EL 建筑画册 / 极简雕塑 / 设计花器）
  color: 'silver',
};

// 结构基准尺寸（单位：米），逆向自原始模型网格聚类
export const DEPTH = 0.40;        // 框架深度
export const LEVEL_PITCH = 0.45;  // 层高
export const POST_H_BASE = 0.05;  // 立柱顶部加高

// 型材系列：截面宽×高（米）与净截面积（平方米，含槽口扣减，用于自重计算）
export const PROFILE_SERIES = {
  '2020': { label: '2020', w: 0.02, h: 0.02, area: 1.18e-4 },
  '2040': { label: '2040', w: 0.02, h: 0.04, area: 2.51e-4 },
};

export const FRAME_MODES = { glb: { label: 'GLB 精确节点' }, standard: { label: '标准参数架' } };

// 层板类型：rib = 型材层板 / acrylic = 磨砂亚克力整板 / none = 无
export const DECK_TYPES = {
  rib:   { label: '型材层板' },
  acrylic: { label: '磨砂亚克力' },
  none:  { label: '无' },
};

// 阳极氧化配色（银色加深一档提升白底对比）
export const COLORS = {
  silver:    { label: '银色', hex: 0x9ba1a8, roughness: 0.30, metalness: 0.94 },
  black:     { label: '黑色', hex: 0x24262a, roughness: 0.40, metalness: 0.86 },
  champagne: { label: '香槟', hex: 0xb89f78, roughness: 0.36, metalness: 0.90 },
};

// 背板（背面侧挡板）配色：独立于型材阳极氧化色
export const PANEL_COLORS = {
  galv:  { label: '镀锌银灰', hex: 0xc7cdd1, roughness: 0.52, metalness: 0.45 },
  white: { label: '哑白',     hex: 0xeceae6, roughness: 0.70, metalness: 0.05 },
  black: { label: '哑黑',     hex: 0x2b2d30, roughness: 0.60, metalness: 0.20 },
};

// 安装说明（文末折叠区）
export const INSTALL_STEPS = [
  { t: '清点核验', d: '按算料单核对型材数量与下料长度，五金包按连接件、螺栓、支脚分格清点。' },
  { t: '组装侧框架', d: '在平整地面将左右各一列立柱与侧向横梁用角件连接，螺栓预紧但不上死，保持角件可微调。' },
  { t: '立架并连前后梁', d: '立起两侧框架，按跨宽顺序装入前后横梁，对齐 T 槽后逐一锁紧角件螺栓。' },
  { t: '铺设层板', d: '按逐层配置放入型材板条或磨砂亚克力板：板条压入横梁上槽，亚克力板垫 EVA 缓冲垫后平放就位。' },
  { t: '加装侧挡板', d: '背面波纹侧板自下而上插入立柱槽口，每层与横梁固定一次。' },
  { t: '调平锁死', d: '调节底部支脚找平（对角线误差 ≤ 2 mm），全部螺栓按对角顺序复紧，静置 24 小时后复检。' },
];

export const ALU_DENSITY = 2700;    // kg/m³

// ---- 下料修正模型（算料单唯一依据）----
// 梁的名义尺寸是"柱中心距"，真实下料必须扣除两端立柱占宽与角件装配间隙。
// 改这里即可与加工厂的实际节点工艺对齐；cutList 同时输出净跨与下料长两列可追溯。
export const JOINT_GAP = 0.002;     // 未验证假设：每端间隙（米），不能用于生产下料

/** 梁下料长 = 柱中心距 − 立柱占宽 − 两端角件间隙 */
export function beamCutLength(span, postW = 0.02) {
  return +(span - postW - 2 * JOINT_GAP).toFixed(3);
}
export const ACRYLIC_DENSITY = 1180; // kg/m³（磨砂亚克力）
export const PANE_THICKNESS = 0.008;
export const RIB_SPACING = 0.028;   // 层板条间距
export const DECK_STRIP = { w: 0.024, h: 0.016, area: 9.2e-5 };  // 型材层板条截面
export const PANEL_RIB = { w: 0.024, h: 0.008, area: 2.4e-5 };   // 侧板条截面

/** 规整配置：补齐 decks / bayWidths 数组并裁剪到当前 bays / levels */
export function normalizeConfig(cfg) {
  const c = { ...cfg };
  if (!Array.isArray(c.decks) || c.decks.length !== c.levels) {
    const decks = [];
    for (let i = 0; i < c.levels; i++) decks.push(c.decks && c.decks[i] ? c.decks[i] : 'rib');
    c.decks = decks;
  }
  if (!Array.isArray(c.backs) || c.backs.length !== c.levels) {
    const backs = [];
    for (let i = 0; i < c.levels; i++) backs.push(c.backs && c.backs[i] === 'none' ? 'none' : 'panel');
    c.backs = backs;
  }
  if (!Array.isArray(c.bayWidths) || c.bayWidths.length !== c.bays) {
    const bw = [];
    for (let i = 0; i < c.bays; i++) bw.push(c.bayWidths && c.bayWidths[i] ? +Number(c.bayWidths[i]).toFixed(2) : DEFAULT_BAY_WIDTH);
    c.bayWidths = bw;
  } else {
    c.bayWidths = c.bayWidths.map(w => +Number(w).toFixed(2));
  }
  return c;
}
