// 光轴挂衣架配置（两种样式）
// classic 光轴抽屉柜：4×⌀30 光轴立柱 + 顶框/置物搁板 + 居中挂衣杆 + 底部抽屉柜 + 2020 底框 + 万向轮
// atelier 原木水磨石：复刻 ref/挂衣架.glb —— 水磨石底座 + 原木圆杆环梁 + 十字木套筒
//         + 藤编搁板 + V 形托架挂衣杆 + 湖蓝双抽屉柜（水磨石台面）/ 翻盖收纳箱
// 可调：样式 / 宽 W / 深 D / 总高 H（立柱长度）/ 抽屉层数（atelier 为储物模块数）/ 滚轮 / 表面（atelier 为木色）

export const RAIL_BEAM = 0.02;     // 2020 横杆截面
export const POST_D = 0.03;        // 30mm 立柱截面
export const DENSITY_ALU = 2700;   // 铝 kg/m³
export const DENSITY_PLY = 680;    // 柜体胶合板 kg/m³

export const LIMITS = {
  width: [0.8, 2.0],      // 宽（挂杆方向 X，原模型挂衣杆约 1.402m）
  depth: [0.35, 0.8],     // 深（前后进深 Z，原模型约 0.504m）
  height: [2.0, 2.6],     // 总高 H（原模型约 2.485m）
  drawers: [0, 3],
};

export const DEFAULT_HANGER_CONFIG = {
  style: 'classic',       // 'classic' 光轴抽屉柜 | 'atelier' 原木水磨石（GLB 复刻）
  width: 1.40,
  depth: 0.50,
  height: 2.40,
  drawers: 2,
  wheels: true,
  color: 'silver',
};

export const HANGER_STYLES = {
  classic: { label: '光轴抽屉柜', preset: { wheels: true } },
  atelier: { label: '原木水磨石', preset: { wheels: false } },   // GLB 原型为落地底座
};

// atelier 样式下 color 键映射为木色（沿用同一配置键，分享链接与持久化无需新增字段）
export const ATELIER_TONES = {
  silver:    { label: '白蜡木', hex: 0xd9cfc1, sleeve: 0xe3d9cb },
  black:     { label: '炭烤木', hex: 0x4b433d, sleeve: 0x5a5049 },
  champagne: { label: '橡木',   hex: 0xc39c6c, sleeve: 0xcfab7e },
};

// atelier 储物模块（drawers 参数 0-3）
export const ATELIER_MODULES = ['无储物', '抽屉柜', '抽屉柜 + 收纳箱', '双箱 + 抽屉柜'];

export const HANGER_COLORS = {
  silver:    { label: '银色', hex: 0x9ba1a8, roughness: 0.30, metalness: 0.94 },
  black:     { label: '黑色', hex: 0x24262a, roughness: 0.40, metalness: 0.86 },
  champagne: { label: '香槟', hex: 0xb89f78, roughness: 0.36, metalness: 0.90 },
};

export const INSTALL_STEPS_HANGER = [
  { t: '底框组装', d: '拼装底框与万向轮，对角校平。' },
  { t: '立柱安装', d: '四根立柱插入底框四角，锁紧角件并用水平尺找到垂直。' },
  { t: '柜体安装', d: '下方矮柜推入四柱之间，底板与底框固定；按层数装层板/抽拉抽屉。' },
  { t: '层杆安装', d: '自下而上安装后框挂衣横杆，每层两端用 T 型夹块锁紧立柱。' },
  { t: '调平验收', d: '满载推拉一次，检查轮刹、轨道与立柱垂直度；需要固定时换调平地脚。' },
];
