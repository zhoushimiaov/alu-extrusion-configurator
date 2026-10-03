// 光轴木展车配置（参考图：胶合板底台 + 洞洞板展墙 + 光轴立柱 + 层板 + 顶台板 + 挂架 + 万向轮）
// 结构：胶合板底台（3 寸万向轮）+ 后部洞洞板展墙 + 全进深层板 + 顶台板
//       + 4 根 ⌀16 光轴立柱（通到顶）+ 正面卡片挂杆 / 顶部挂架 / 侧向挂杆（⌀12，十字夹块）
export const ROD_D = 0.016;        // ⌀16 光轴立柱
export const RAIL_D = 0.012;       // ⌀12 挂杆
export const BOARD_T = 0.012;      // 胶合板厚
export const DENSITY_STEEL = 7850;
export const DENSITY_PLY = 680;    // 胶合板 kg/m3

export const LIMITS = {
  width: [0.6, 1.2],     // 柱心距 X
  depth: [0.35, 0.65],   // 柱心距 Z
  height: [1.6, 2.6],    // 立柱总高
  shelves: [1, 3],       // 中间层板数量（整数）
  cabinetH: [0.9, 1.4],  // 顶台板高度（洞洞板展墙高）
  ohF: [-0.15, 0.15],    // 板材前向外伸（正扩负缩，m）
  ohB: [-0.15, 0.15],    // 板材后向外伸
  ohL: [-0.15, 0.15],    // 板材左向外伸
  ohR: [-0.15, 0.15],    // 板材右向外伸
};

export const DEFAULT_WOODCART_CONFIG = {
  width: 0.8,
  depth: 0.45,
  height: 2.15,
  shelves: 2,
  cabinetH: 1.18,        // 顶台板高度（展墙顶；字段名沿用旧版柜体高以兼容分享链接）
  pegboard: true,        // 洞洞板背板
  topRail: true,         // 顶部挂杆
  sideRail: true,        // 侧向挂杆
  casters: true,         // 万向轮
  woodTone: 'birch',     // 'birch' 桦木 | 'oak' 橡木 | 'walnut' 胡桃
  ohF: 0,                // 板材前向外伸（m）
  ohB: 0,                // 板材后向外伸
  ohL: 0,                // 板材左向外伸
  ohR: 0,                // 板材右向外伸
  ohLink: true,          // 四向外伸联动（改一边四边同步）
};

export const WOOD_TONES = {
  birch: { label: '桦木' },
  oak: { label: '橡木' },
  walnut: { label: '胡桃' },
};

export const INSTALL_STEPS_WOODCART = [
  { t: '底台与轮组', d: '胶合板底台四角装 3 寸万向轮（带刹车），翻正后对角校平。' },
  { t: '立柱安装', d: '四根 ⌀16 光轴立柱穿入底台角孔，板下夹块锁紧，校垂直。' },
  { t: '展墙与层板', d: '自下而上：洞洞板分段 + 封边立板，层板套柱落到板下夹块上，逐层校水平。' },
  { t: '顶台板', d: '顶台板套柱压住展墙顶边，板下夹块锁紧。' },
  { t: '挂杆安装', d: '正面卡片挂杆、顶部挂架与侧向挂杆穿入十字夹块并锁紧，用于悬挂包袋与卡片。' },
  { t: '验收', d: '满载推拉测试，检查轮刹、立柱垂直度与层板水平度。' },
];
