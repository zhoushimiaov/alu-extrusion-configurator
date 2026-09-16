// 光轴展架配置（忠实参考模型：单排双柱海报展示架）
// 结构：2 根 ⌀20 光轴立柱 + 4 根 ⌀12 横杆（底部双杆置物框 / 中档 / 顶档）
//       + 镀锌背板或海报画面 + 底部托板/层板 + 双横轴底叉 + 万向轮
// 立柱长度（总高）与柱心距均可调；底部托板可选窄托板或全深镀锌层板
export const ROD_D = 0.02;        // ⌀20 立柱 / 底叉 / 底盘横轴
export const RAIL_D = 0.012;      // ⌀12 横杆 / 斜撑 / 端连接
export const ROD_DENSITY = 7850;  // 钢 kg/m3（镀铬钢）
export const ZINC_DENSITY = 7850; // 镀锌板钢

export const ROD_STYLES = {
  poster: { label: '海报架' },
  panel: { label: '双联展板' },
  acrylic: { label: '亚克力展示屏' },
};

export const LIMITS = {
  width: [0.5, 1.0],    // 柱心距
  height: [1.0, 2.0],   // 立柱长度（步进 0.1）
};

export const DEFAULT_ROD_CONFIG = {
  style: 'poster',      // poster 海报架 | panel 双联展板 | acrylic 亚克力展示屏
  width: 0.8,          // 柱心距（模型 0.8m）
  height: 1.2,         // 立柱长度（模型 1.2m）
  backPanel: 'poster', // 'zinc' 镀锌背板 | 'poster' 海报画面 | 'none' 无
  shelf: 'tray',       // 'none' 无 | 'tray' 窄托板 | 'deck' 镀锌层板
  casters: true,       // 万向轮底盘（false 为调平地脚）
  color: 'chrome',     // chrome | black | steel
};

export const BACK_TYPES = {
  zinc: { label: '镀锌背板' },
  poster: { label: '海报画面' },
  none: { label: '无背板' },
};

export const SHELF_TYPES = {
  none: { label: '无' },
  tray: { label: '窄托板' },
  deck: { label: '镀锌层板' },
};

export const ROD_COLORS = {
  chrome: { label: '镀铬', hex: 0xd8dde2 },
  black: { label: '黑色', hex: 0x2a2d31 },
  steel: { label: '不锈钢', hex: 0xb8bdc3 },
};

export const PRICE_ROD = {
  base: 420,
  perWidth: 300,        // 每米柱心距
  heightSurcharge: 260, // 超出基准高度 1.2m 部分，每米加价
  backZinc: 120,
  backPoster: 150,
  shelfTray: 60,
  shelfDeck: 90,
  casters: 80,
};

export const INSTALL_STEPS_ROD = [
  { t: '底盘组装', d: '将两根底盘横轴平行卡入底叉，锁紧顶丝，确认前后轮距一致。' },
  { t: '立柱固定', d: '两根光轴立柱插入底叉锥孔，用水平尺校准垂直后拧紧夹箍。' },
  { t: '横杆安装', d: '自下而上将横杆两端卡入 T 型夹块，先装底部双杆置物框，再装中档与顶档横杆。' },
  { t: '背板挂装', d: '将镀锌背板（或海报画面）上下边框对准中档与顶档横杆，卡入挂扣。' },
  { t: '托板 / 层板', d: '窄托板或全深镀锌层板平放于底部框内，调整居中后压紧托夹。' },
  { t: '调平验收', d: '推动整机试运行，检查四轮着地与刹车；固定安装时换装调平地脚。' },
];
