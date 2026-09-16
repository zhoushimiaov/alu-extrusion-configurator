// 光轴木展车配置（参考图：胶合板柜体 + 洞洞板背板 + 光轴立柱 + 顶部挂杆 + 木层板 + 万向轮）
// 结构：底部胶合板柜体（含洞洞板背板）+ 4 根 ⌀16 光轴立柱 + 中部 2 层胶合板层板
//       + 顶部 ⌀12 光轴挂杆（横跨立柱，挂包）+ 4 万向轮
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
};

export const DEFAULT_WOODCART_CONFIG = {
  width: 0.8,
  depth: 0.45,
  height: 2.15,
  shelves: 2,
  cabinetH: 0.72,        // 底部柜体高
  pegboard: true,        // 洞洞板背板
  topRail: true,         // 顶部挂杆
  sideRail: true,        // 侧向挂杆
  casters: true,         // 万向轮
  woodTone: 'birch',     // 'birch' 桦木 | 'oak' 橡木 | 'walnut' 胡桃
};

export const WOOD_TONES = {
  birch: { label: '桦木' },
  oak: { label: '橡木' },
  walnut: { label: '胡桃' },
};

export const INSTALL_STEPS_WOODCART = [
  { t: '柜体组装', d: '拼装底部胶合板柜体（侧板 + 底板 + 洞洞板背板），角码锁紧。' },
  { t: '轮组安装', d: '柜体底部装四只万向轮（带刹车），对角校平。' },
  { t: '立柱安装', d: '四根 ⌀16 光轴立柱穿入柜体四角法兰，垂直校准后锁紧顶丝。' },
  { t: '层板安装', d: '中层板套入立柱，用光轴夹块定位到标高，逐层校正水平。' },
  { t: '挂杆安装', d: '顶部与侧向挂杆穿入立柱十字夹块，锁紧；用于悬挂包袋与挂饰。' },
  { t: '验收', d: '满载推拉测试，检查轮刹、立柱垂直度与层板水平度。' },
];
