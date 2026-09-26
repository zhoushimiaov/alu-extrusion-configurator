// 光轴书架配置（Villa Medici 阅读装置：可移动展示塔 + 阅读长桌）
// 塔式：铬管框架 + 逐层斜面展板（前挡唇 + 可选亚克力前挡）+ 交叉拉索 + 木箱脚轮基座
// 长桌：木台面 + 可选玻璃副层板 + 光轴桌腿 + 底部横杆
export const BOOK_STYLES = {
  tower: { label: '展示塔' },
  table: { label: '阅读长桌' },
};

// 展板材质（塔式斜面板）
export const PANEL_MATERIALS = {
  gray:    { label: '麻灰板',   hex: 0xb9beb2, roughness: 0.62, metalness: 0.05 },
  spangle: { label: '幻彩镀锌', hex: 0xc6ccd3, roughness: 0.5,  metalness: 0.45, spangle: true },
  white:   { label: '哑白',     hex: 0xe8e6e0, roughness: 0.6,  metalness: 0.08 },
};

// 框架表面（铬管）
export const FRAME_COLORS = {
  chrome: { label: '镀铬', hex: 0xd8dde2 },
  black:  { label: '黑色', hex: 0x2a2d31 },
  steel:  { label: '不锈钢', hex: 0xb8bdc3 },
};

export const LIMITS = {
  bays: [1, 2],        // 塔式跨数
  levels: [2, 5],      // 层数
  bayW: [0.8, 1.2],    // 跨宽（步进 0.05）
  depth: [0.28, 0.45], // 框架深度（步进 0.01）
  tilt: [20, 40],      // 展板倾角（度，步进 2）
  tBays: [1, 3],       // 长桌节数
  tBayW: [0.6, 1.0],   // 长桌每节宽（步进 0.05）
};

export const DEFAULT_BOOKSHELF_CONFIG = {
  schemaVersion: 2,
  kind: 'books',       // 产品标记（HUD 读数分支）
  style: 'tower',      // tower 展示塔 | table 阅读长桌
  bays: 1,             // 塔式跨数
  levels: 4,           // 层数
  bayW: 1.0,           // 跨宽
  depth: 0.34,         // 框架深度
  tilt: 30,            // 展板倾角（度）
  base: true,          // 木箱基座（含脚轮；false 为调平地脚）
  wires: true,         // 交叉拉索
  acrylic: true,       // 亚克力前挡
  panelMat: 'gray',    // 展板材质
  books: true,         // 放上书（斜面展板上陈列样书）
  color: 'chrome',     // 框架表面
  tBays: 3,            // 长桌节数
  tBayW: 0.7,          // 长桌每节宽
};

export const INSTALL_STEPS_BOOKSHELF = [
  { t: '基座就位', d: '木箱基座置于平整地面并装好四只脚轮（固定安装换调平地脚），校准水平。' },
  { t: '立柱安装', d: '铬管立柱按跨距插入基座顶面连接件，前后两排对齐，先不上死。' },
  { t: '横杆分层', d: '自下而上装入各层前后横杆：前杆低、后杆高，卡入柱上夹块后统一锁紧。' },
  { t: '斜面板就位', d: '展板下沿抵住前横杆、上沿靠往后横杆，前挡唇朝外；逐层装亚克力前挡并锁 standoff。' },
  { t: '交叉拉索', d: '每跨每层交叉张紧两根细拉索，弹簧端朝内，力度以手压不碰板为准。' },
  { t: '载书验收', d: '放入样书检查倾角与挡唇高度，推动试运行确认脚轮刹车有效。' },
];
