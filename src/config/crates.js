// 周转箱收纳架配置（参考图：2040 铝架 + 多层抽拉式物流周转箱 + 万向轮）
// 结构：4×2040 立柱 + 顶部开放方框 + 底框 + 每层两根 2020 滑轨（前后向）
//       + 每层一只梯形周转箱（可抽出展示），箱色按方案分配
export const RAIL_BEAM = 0.02;     // 2020 滑轨截面
export const DENSITY_ALU = 2700;

export const LIMITS = {
  width: [0.45, 0.9],    // 柱心距 X
  depth: [0.32, 0.62],   // 柱心距 Z
  height: [0.55, 1.2],   // 立柱长度
  tiers: [2, 6],         // 层数（整数）
};

export const DEFAULT_CRATES_CONFIG = {
  width: 0.62,
  depth: 0.42,
  height: 0.95,
  tiers: 4,
  scheme: 'mix',       // 'mix' 混搭 | 'black' | 'white' | 'cool' 灰蓝 | 'olive'
  pullOut: true,       // 抽出展示（每层交错抽出）
  casters: true,       // 万向轮（false 为调平地脚）
};

export const CRATE_SCHEMES = {
  mix: { label: '混搭' },
  black: { label: '全黑' },
  white: { label: '全白' },
  cool: { label: '灰蓝' },
  olive: { label: '橄榄绿' },
};

// 周转箱配色（参考图四色）
export const CRATE_COLORS = {
  black: { label: '黑', hex: 0x1d1f22, rib: 0x141518 },
  white: { label: '白', hex: 0xf2f3f0, rib: 0xd9dbd6 },
  cool: { label: '灰蓝', hex: 0x93a7ba, rib: 0x7c90a4 },
  olive: { label: '橄榄绿', hex: 0x6e7d42, rib: 0x5c6a36 },
};

// 方案 → 每层颜色序列（超出层数循环）
export const SCHEME_SEQ = {
  mix: ['black', 'white', 'cool', 'olive'],
  black: ['black'],
  white: ['white'],
  cool: ['cool'],
  olive: ['olive'],
};

export const INSTALL_STEPS_CRATES = [
  { t: '底框与轮组', d: '拼装底框并装四只万向轮（带刹车），对角校平。' },
  { t: '立柱安装', d: '四根 2040 立柱插入底框四角，锁紧角件。' },
  { t: '层轨安装', d: '按层装 2020 滑轨（前后向），确保两侧轨道水平等高。' },
  { t: '顶部方框', d: '立柱顶端装顶部方框，角件锁紧，可放置物品。' },
  { t: '放入周转箱', d: '周转箱沿滑轨推入各层，标签朝外；抽取测试顺滑。' },
  { t: '调平验收', d: '满载推拉一次，检查轮刹与轨道变形，必要时调平。' },
];
