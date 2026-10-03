// 移动边几配置（参考图：铝型材木纹框 + 玻璃顶 + 橙色亚克力中板 + 光轴挂杆 + 万向轮）
// 结构：4 条组合腿（2020 T 槽型材居中 + 两侧 60×18 木纹板）+ 顶/中框 + 双层叠梁底框（全 2020 T 槽）
//       + 顶部钢化玻璃（绿边、腿心广告钉）+ 中层亚克力托板 + 前后 ⌀12 光轴挂杆（L 型光轴支座锁 T 槽）
//       + 挂杆竖向亚克力立板（板面光轴支座）+ 4 万向轮；整体约 0.68W × 0.70H × 0.55D
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
  hangPanels: true,    // 挂杆竖向亚克力挂板（随中板材质；需挂杆）
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
  { t: '组合腿', d: '每条腿：2020 型材两侧各贴一块 60×18 木纹板，T 槽面朝前后，沉头螺丝预紧。' },
  { t: '底框组装', d: '用 2020 双层叠梁与内置连接件拼装底层方框：前后梁顶住腿内侧木板，侧梁插进两板之间顶住型材。' },
  { t: '中层框 + 中板', d: '装中层 2020 框，亚克力托板落于框沿。' },
  { t: '光轴挂杆', d: 'L 型光轴支座锁进腿部型材正面 T 槽，前后 ⌀12 光轴穿入锁紧，杆头两端各出约 6cm。' },
  { t: '亚克力立板', d: '立板贴在挂杆之后，板面光轴支座（外六角 + 内六角紧定）锁住上下两根挂杆。' },
  { t: '顶框 + 玻璃', d: '装顶部方框，玻璃台面置于框上，四角垫减震垫片。' },
  { t: '轮子与调平', d: '装四只万向轮（带刹车），推动试运行并调平。' },
];
