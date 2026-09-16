// 移动边几配置（参考图：铝型材木纹框 + 玻璃顶 + 橙色亚克力中板 + 光轴挂杆 + 万向轮）
// 结构：4 根 2040 立柱（木纹贴膜）+ 顶/中/底三层 2020 框梁
//       + 顶部钢化玻璃 + 中层橙色亚克力板 + 前后 ⌀12 光轴挂杆（十字夹块）
//       + 底框 + 4 万向轮；整体约 0.55W × 0.60H × 0.50D
export const CART_D = 0.02;        // ⌀20 立柱截面（2040 单位宽）
export const RAIL_D = 0.012;       // ⌀12 光轴挂杆
export const DENSITY_ALU = 2700;   // 铝 kg/m3
export const DENSITY_STEEL = 7850; // 钢 kg/m3

export const LIMITS = {
  width: [0.4, 0.8],     // 柱心距（X 向）
  depth: [0.35, 0.65],   // 柱心距（Z 向）
  height: [0.45, 0.9],   // 立柱长度
};

export const DEFAULT_CART_CONFIG = {
  width: 0.5,          // 柱心距 X
  depth: 0.4,          // 柱心距 Z
  height: 0.55,        // 立柱长度（台面高度 ≈ height + 轮 0.08）
  glassTop: true,      // 顶部钢化玻璃
  midAcrylic: 'amber', // 'amber' 橙色亚克力 | 'frost' 磨砂 | 'none' 无
  rodRails: true,      // 前后光轴挂杆（十字夹块）
  casters: true,       // 万向轮（false 为调平地脚）
  woodFinish: 'oak',   // 'oak' 原木色 | 'walnut' 胡桃 | 'natural' 铝原色
};

export const ACRYLIC_TYPES = {
  amber: { label: '橙色亚克力' },
  frost: { label: '磨砂亚克力' },
  none: { label: '无' },
};

export const WOOD_FINISHES = {
  oak: { label: '原木色', hex: 0xc9a875 },
  walnut: { label: '胡桃色', hex: 0x6b4a32 },
  natural: { label: '铝原色', hex: 0xd4d8dc },
};

export const INSTALL_STEPS_CART = [
  { t: '底框组装', d: '用 2020 梁与内置连接件拼装底层方框，对角校正后拧紧。' },
  { t: '立柱安装', d: '四根 2040 立柱插入底框四角，确保轮向缺口朝外侧。' },
  { t: '中层框 + 中板', d: '装中层 2020 框，橙色亚克力板落于框沿，压上压条。' },
  { t: '光轴挂杆', d: '前后 ⌀12 光轴穿入十字夹块，与两侧立柱锁紧。' },
  { t: '顶框 + 玻璃', d: '装顶部方框，玻璃台面置于框上，四角垫减震垫片。' },
  { t: '轮子与调平', d: '装四只万向轮（带刹车），推动试运行并调平。' },
];
